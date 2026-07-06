"""Workflow editor — ontology-safe edit layer + SOP generation (V2 #21).

workflow_steps is the claim-derived truth and is NEVER updated here. Every admin edit is
an append-only row in workflow_step_overlays; the "effective" workflow is the base steps
folded with those overlays (latest-wins per field). This keeps a claim-derived step and
its edited presentation separable forever — provenance is always recoverable, a remove is
a reversible soft_hide, and a manual step lives only as an overlay (never evidence-backed).

Verbs:
- effective_workflow  — fold base + overlays into what the editor renders.
- apply_op            — record one edit as an overlay, with prior_value provenance.
- generate_sop (job)  — render the SOP document from the EFFECTIVE steps (edits included).
- blueprint           — the non-executable Skill Blueprint: 9 spine slots + action boundary.
"""

import json
from datetime import datetime, timezone

from ..db import get_pool
from ..llm import extract_json, run_agent
from ..queue import handles
from .compiler import _load_industry_block

_OPS = {"reorder", "rename", "annotate", "add_manual", "soft_hide", "unhide"}
_STEP_STATUS = {"verified": "verified", "partial": "partial", "unverified": "needs_clarification"}

# The 9 universal spine slots (A10 / Spine PDF) + the action-boundary seam A10 preserved
# for a future skill compiler. Aliases map whatever the workflow prompt emits onto the
# canonical set so the blueprint always renders all ten, empty where not yet captured.
_SPINE_CANON: list[tuple[str, tuple[str, ...]]] = [
    ("task", ("task",)),
    ("trigger", ("trigger",)),
    ("steps", ("steps",)),
    ("decision_rules", ("decision_rules", "rules")),
    ("exceptions", ("exceptions",)),
    ("tools_systems", ("tools_systems", "tools", "tools_and_systems")),
    ("output_format", ("output_format", "output")),
    ("success_criteria", ("success_criteria", "success")),
    ("examples", ("examples",)),
    ("action_boundary", ("action_boundary", "boundary")),
]


def _loads(v, default=None):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return default
    return v if v is not None else default


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _base_steps(pool, workflow_id: str) -> list[dict]:
    rows = await pool.fetch(
        """select id, step_index, action, tool, input, output, verified,
                  spine_slots, slot_scores, claim_ids
           from workflow_steps where workflow_id = $1 order by step_index""",
        workflow_id,
    )
    out = []
    for r in rows:
        spine = _loads(r["spine_slots"], {}) or {}
        out.append({
            "step_id": str(r["id"]),
            "source": "claim_derived",
            "sort": float(r["step_index"]),
            "title": spine.get("task") or (r["action"] or "Step")[:60],
            "action": r["action"], "tool": r["tool"],
            "input": r["input"], "output": r["output"],
            "status": _STEP_STATUS.get(r["verified"], "needs_clarification"),
            "hidden": False, "annotations": [], "edits": [],
            "spine_slots": spine, "claim_ids": [str(c) for c in r["claim_ids"]],
        })
    return out


def _fold(base: list[dict], overlays: list[dict]) -> list[dict]:
    """Apply overlays (created_at order) over the immutable base. Latest wins per field."""
    steps: dict[str, dict] = {s["step_id"]: s for s in base}
    max_sort = max((s["sort"] for s in base), default=-1.0)

    for ov in overlays:
        op, payload = ov["op"], _loads(ov["payload"], {}) or {}
        stamp = {"op": op, "actor": ov["actor"], "at": ov["created_at"].isoformat()
                 if hasattr(ov["created_at"], "isoformat") else str(ov["created_at"]),
                 "prior_value": _loads(ov["prior_value"])}
        if op == "add_manual":
            after = payload.get("after_index")
            max_sort += 1.0
            sort = (float(after) + 0.5) if after is not None else max_sort
            sid = str(ov["id"])
            steps[sid] = {
                "step_id": sid, "source": "manual", "sort": sort,
                "title": (payload.get("action") or "Manual step")[:60],
                "action": payload.get("action"), "tool": payload.get("tool"),
                "input": payload.get("input"), "output": payload.get("output"),
                "status": "needs_clarification", "hidden": False,
                "annotations": [], "edits": [stamp], "spine_slots": {}, "claim_ids": [],
            }
            continue
        s = steps.get(str(ov["step_id"]))
        if s is None:
            continue  # overlay for a step that no longer exists — skip, but it stays in history
        if op == "rename":
            field = payload.get("field") if payload.get("field") in ("action", "title") else "action"
            s[field] = payload.get("value")
            s["edits"].append(stamp)
        elif op == "reorder":
            s["sort"] = float(payload.get("new_index", s["sort"]))
            s["edits"].append(stamp)
        elif op == "annotate":
            s["annotations"].append({"note": payload.get("note", ""), "actor": ov["actor"], "at": stamp["at"]})
        elif op == "soft_hide":
            s["hidden"] = True
            s["edits"].append(stamp)
        elif op == "unhide":
            s["hidden"] = False
            s["edits"].append(stamp)

    ordered = sorted(steps.values(), key=lambda s: (s["sort"], s["step_id"]))
    for i, s in enumerate(ordered):
        s["index"] = i
        s["edited"] = bool(s["edits"] or s["annotations"] or s["hidden"] or s["source"] == "manual")
    return ordered


def _present(steps: list[dict]) -> list[dict]:
    """Editor-facing projection (drops internal sort key; keeps provenance)."""
    return [{
        "step_id": s["step_id"], "index": s["index"], "source": s["source"],
        "hidden": s["hidden"], "title": s["title"], "action": s["action"],
        "tool": s["tool"], "input": s["input"], "output": s["output"],
        "status": s["status"], "annotations": s["annotations"], "edited": s["edited"],
        "provenance": {"edits": s["edits"]},
        "spine_slots": s["spine_slots"], "claim_ids": s["claim_ids"],
    } for s in steps]


async def effective_workflow(pool, workflow_id: str) -> dict:
    wf = await pool.fetchrow("select id, name from workflows where id = $1", workflow_id)
    if wf is None:
        raise LookupError("workflow not found")
    base = await _base_steps(pool, workflow_id)
    overlays = await pool.fetch(
        "select id, step_id, op, payload, prior_value, actor, created_at "
        "from workflow_step_overlays where workflow_id = $1 order by created_at",
        workflow_id,
    )
    folded = _fold(base, [dict(o) for o in overlays])
    return {"workflow_id": str(wf["id"]), "name": wf["name"], "steps": _present(folded)}


async def apply_op(pool, workflow_id: str, op: str, step_id: str | None,
                   payload: dict, actor: str = "admin") -> str:
    """Record one edit as an overlay. Computes prior_value from the CURRENT effective
    state so provenance is exact. Base workflow_steps rows are never touched."""
    if op not in _OPS:
        raise ValueError(f"unknown op {op!r}")
    if await pool.fetchval("select 1 from workflows where id = $1", workflow_id) is None:
        raise LookupError("workflow not found")

    current = {s["step_id"]: s for s in _fold(
        await _base_steps(pool, workflow_id),
        [dict(o) for o in await pool.fetch(
            "select id, step_id, op, payload, prior_value, actor, created_at "
            "from workflow_step_overlays where workflow_id = $1 order by created_at", workflow_id)],
    )}

    prior = None
    if op == "add_manual":
        step_id = None
    else:
        if step_id is None or str(step_id) not in current:
            raise LookupError(f"step {step_id} not in workflow")
        s = current[str(step_id)]
        if op == "rename":
            field = payload.get("field") if payload.get("field") in ("action", "title") else "action"
            prior = {field: s[field]}
        elif op == "reorder":
            prior = {"index": s["index"]}
        elif op in ("soft_hide", "unhide"):
            prior = {"hidden": s["hidden"]}

    overlay_id = await pool.fetchval(
        """insert into workflow_step_overlays (workflow_id, step_id, op, payload, prior_value, actor)
           values ($1,$2,$3,$4,$5,$6) returning id""",
        workflow_id, step_id, op, json.dumps(payload),
        json.dumps(prior) if prior is not None else None, actor,
    )
    return str(overlay_id)


async def history(pool, workflow_id: str) -> list[dict]:
    rows = await pool.fetch(
        "select id, step_id, op, payload, prior_value, actor, created_at "
        "from workflow_step_overlays where workflow_id = $1 order by created_at desc",
        workflow_id,
    )
    return [{
        "overlay_id": str(r["id"]), "step_id": str(r["step_id"]) if r["step_id"] else None,
        "op": r["op"], "payload": _loads(r["payload"], {}),
        "prior_value": _loads(r["prior_value"]), "actor": r["actor"],
        "at": r["created_at"].isoformat(),
    } for r in rows]


def _normalize_slots(spine: dict) -> dict:
    """Map emitted slot keys onto the canonical 9 + action_boundary; empty where absent.
    Preserve the slots (A10) — we render them, we never execute them."""
    out = {}
    for canon, aliases in _SPINE_CANON:
        val = next((spine[a] for a in aliases if a in spine and spine[a] not in (None, "", [])), None)
        out[canon] = val
    return out


async def blueprint(pool, workflow_id: str) -> dict:
    """Non-executable Skill Blueprint: per step, the 9 spine slots + action boundary.
    A completeness rubric (is this workflow fully understood?), never a build spec (A10)."""
    eff = await effective_workflow(pool, workflow_id)
    steps = []
    for s in eff["steps"]:
        if s["hidden"]:
            continue
        slots = _normalize_slots(s.get("spine_slots") or {})
        filled = sum(1 for v in slots.values() if v)
        steps.append({
            "index": s["index"], "title": s["title"], "source": s["source"],
            "slots": slots, "slots_filled": filled, "slots_total": len(_SPINE_CANON),
            "unfilled": [k for k, v in slots.items() if not v],
        })
    return {
        "workflow_id": eff["workflow_id"], "name": eff["name"],
        "executable": False,  # A10: documents + metadata only, never a skill promise
        "steps": steps,
    }


# ── SOP generation job ───────────────────────────────────────────────────────
_SOP_CONTRACT = """# Produce the SOP document as JSON only, no prose around it
{
  "title": "short SOP title in the client's terms",
  "overview": "one or two plain sentences on what this procedure covers",
  "steps": [ {"n": 1, "name": "step name", "instructions": "how it is done, in the respondent's vocabulary", "tool": "tool/system or null", "note": "caveat or null"} ],
  "follow_ups": ["an unfilled spine slot or open gap worth closing next"]
}
Rules: deduped steps in order; no em-dashes; no raw code; no provenance dumps; documents not skills."""


async def generate_sop(payload: dict) -> None:
    workflow_id = payload["workflow_id"]
    pool = await get_pool()
    wf = await pool.fetchrow(
        "select w.id, w.name, w.workspace_id, ws.industry from workflows w "
        "join workspaces ws on ws.id = w.workspace_id where w.id = $1",
        workflow_id,
    )
    if wf is None:
        raise RuntimeError(f"generate_sop: no workflow {workflow_id}")

    eff = await effective_workflow(pool, workflow_id)
    visible = [s for s in eff["steps"] if not s["hidden"]]
    step_lines = "\n".join(
        f'{s["index"] + 1}. [{s["source"]}] {s["action"] or s["title"]}'
        f'  (tool: {s["tool"] or "—"}; input: {s["input"] or "—"}; output: {s["output"] or "—"})'
        + ("".join(f'\n   note: {a["note"]}' for a in s["annotations"]))
        for s in visible
    )
    user_content = (
        f"# Workflow: {eff['name']}\n\n# Steps (already edited; render these in order)\n"
        f"{step_lines}\n\n{_SOP_CONTRACT}"
    )
    raw = await run_agent(
        "report_sop_generator", user_content,
        workspace_id=str(wf["workspace_id"]),
        industry_block=_load_industry_block(wf["industry"]),
        max_tokens=4000,
    )
    document = extract_json(raw)
    await pool.execute(
        """insert into workflow_sops (workflow_id, document, generated_at)
           values ($1, $2, now())
           on conflict (workflow_id) do update set document = excluded.document,
             generated_at = now()""",
        workflow_id, json.dumps(document),
    )


@handles("generate_sop")
async def _generate_sop_job(payload: dict) -> None:
    await generate_sop(payload)
