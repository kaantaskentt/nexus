"""build_workflow_schema (Phase 6) — assemble a workflow (ordered steps with
tool/action/input/output + Verified/Partial badges + spine-slot metadata) from a
compiled session's records. The report/SOP generator renders this structure; here we
just build it. Spine slots ride on each step so a future skill compiler can consume
the store without redesign — A10: this measures understanding, never promises automation.

Every step traces to claim record ids; nothing enters that isn't in the store."""

import json
import re

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles

_UUID = re.compile(r"^[0-9a-f-]{36}$", re.I)

# Coarse function buckets the list can group by. Domain-neutral (A14 — industry context is
# runtime-injected, never baked into the taxonomy). The builder assigns ONE only when the
# evidence clearly places the workflow there; anything ambiguous stays null and renders
# under "All" — Nexus classifies only when confident, it never guesses.
DEPARTMENTS = (
    "Operations", "Sales", "Marketing", "Finance",
    "Customer Service", "People", "Product",
)
_DEPT_SET = {d.lower(): d for d in DEPARTMENTS}

_TAXONOMY = (
    ' "description":"one plain-language sentence a manager would recognise, saying what this'
    ' workflow does — client vocabulary, no jargon",'
    ' "department":"exactly one of ' + "|".join(DEPARTMENTS) + ' when the evidence clearly'
    ' places it there, else null — never guess; when unsure, null",'
)

_SCHEMA = (
    'Return ONE json object: {"name":"short workflow name",'
    + _TAXONOMY +
    '"steps":[{"action":"what happens","tool":"tool or null","input":"or null",'
    '"output":"or null","verified":"verified|partial|unverified",'
    '"spine_slots":{"task":"","trigger":"","steps":"","rules":"","exceptions":"",'
    '"tools":"","output":"","success":"","examples":""},'
    '"slot_scores":{"task":0,"trigger":0,"steps":0,"rules":0,"exceptions":0,"tools":0,"output":0,"success":0,"examples":0},'
    '"claim_ids":["id",...]}]}. '
    "Steps in real execution order. verified=corroborated across sources; partial=single-source "
    "or incomplete. slot scores 0=empty 1=partial 2=clear. Every step cites the claim ids it came from."
)


def _clean_department(raw) -> str | None:
    """Normalise the model's department to the controlled vocabulary, else null. Anything
    off-list, empty, or hedged ('unclear', 'n/a') becomes null — unclassified, never guessed."""
    if not isinstance(raw, str):
        return None
    return _DEPT_SET.get(raw.strip().lower())


def _clean_description(raw) -> str | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    return text or None


async def build_workflow_schema(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    session = await pool.fetchrow(
        "select workspace_id from interview_sessions where id = $1", session_id
    )
    if session is None:
        raise RuntimeError(f"build_workflow_schema: no session {session_id}")
    workspace_id = str(session["workspace_id"])

    rows = await pool.fetch(
        """select id, kind, topic, tag, claim_text from client_visible_claims
           where session_id = $1
             and topic in ('process_step','tool','time_or_cost','success_criteria','company_fact')
           order by created_at""",
        session_id,
    )
    if not rows:
        return
    valid_ids = {str(r["id"]) for r in rows}
    lines = "\n".join(f"{r['id']} · {r['topic']}/{r['tag']} · {r['claim_text']}" for r in rows)

    schema = await run_agent_json(
        "report_sop_generator",
        f"Records for this session:\n{lines}\n\n{_SCHEMA}",
        workspace_id=workspace_id, session_id=session_id,
    )

    steps = schema.get("steps") or []
    if not steps:
        return
    workflow_id = await pool.fetchval(
        """insert into workflows (workspace_id, session_id, name, description, department)
           values ($1,$2,$3,$4,$5) returning id""",
        workspace_id, session_id, schema.get("name") or "Workflow",
        _clean_description(schema.get("description")), _clean_department(schema.get("department")),
    )
    for i, s in enumerate(steps):
        claim_ids = [c for c in (s.get("claim_ids") or []) if c in valid_ids and _UUID.match(c)]
        await pool.execute(
            """insert into workflow_steps
                 (workflow_id, step_index, tool, action, input, output, verified,
                  spine_slots, slot_scores, claim_ids)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
            workflow_id, i, s.get("tool"), s.get("action") or "", s.get("input"), s.get("output"),
            s.get("verified") if s.get("verified") in ("verified", "partial", "unverified") else "unverified",
            json.dumps(s.get("spine_slots") or {}), json.dumps(s.get("slot_scores") or {}),
            claim_ids,
        )


async def classify_workflow_taxonomy(name: str, steps: list[dict], *, workspace_id: str) -> dict:
    """Derive {description, department} for a workflow that predates the taxonomy columns,
    from its name + steps. Same confident-only rule as build time: department is null unless
    the evidence clearly places it. Used by the one-off backfill; new workflows get this
    inline in build_workflow_schema (no extra call). Returns {} on any model failure so the
    backfill can skip a row rather than write a guess."""
    lines = "\n".join(
        f"- {s.get('action') or s.get('title') or ''}"
        + (f" (tool: {s['tool']})" if s.get("tool") else "")
        + (f" -> {s['output']}" if s.get("output") else "")
        for s in steps
    )
    prompt = (
        f'Workflow name: "{name}"\nSteps:\n{lines}\n\n'
        'Return ONE json object with exactly these keys: {' + _TAXONOMY.rstrip(", ") + "}. "
        "Base both fields ONLY on the steps above. If the steps do not clearly place the "
        "workflow in one department, department MUST be null."
    )
    try:
        out = await run_agent_json("report_sop_generator", prompt, workspace_id=workspace_id)
    except Exception:
        return {}
    return {
        "description": _clean_description(out.get("description")),
        "department": _clean_department(out.get("department")),
    }


@handles("build_workflow_schema")
async def _build_workflow_schema_job(payload: dict) -> None:
    await build_workflow_schema(payload)
