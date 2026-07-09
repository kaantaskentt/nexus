"""Automation opportunities + honest ROI (Kaan features 2+3, July 8).

One assessor pass per compile over the workspace's client-visible records and mapped
workflows. Structural guarantees (never prompt discipline):
- an opportunity that cites ZERO valid records is DROPPED before storage (Kaan (e));
- workflow/step references are validated against the real fold, or cleared;
- ROI is stored as an estimate object with its assumption text; duration citations are
  validated record ids so "uses captured durations where they exist" is checkable.
Concept credit: Tunç's automation_assessor, vendored with adaptation (docs/FOR-TUNC.md).
"""

import json
import logging

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles
from .workflow_edit import effective_workflow

log = logging.getLogger("nexus.automation")

_SIGNALS = {"manual", "repetitive", "tool-hop"}


async def assess_automation(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    pool = await get_pool()

    claims = await pool.fetch(
        "select id, topic, tag, claim_text, evidence_quote from client_visible_claims "
        "where workspace_id = $1",
        workspace_id,
    )
    if not claims:
        return
    valid_ids = {str(c["id"]) for c in claims}

    wf_rows = await pool.fetch(
        "select id, name from workflows where workspace_id = $1", workspace_id
    )
    workflows: dict[str, dict] = {}
    wf_lines = []
    for w in wf_rows:
        try:
            eff = await effective_workflow(pool, str(w["id"]))
        except LookupError:
            continue
        steps = {s["step_id"]: s for s in eff.get("steps", [])}
        workflows[str(w["id"])] = steps
        step_desc = "; ".join(f"{sid}: {s.get('action') or s.get('title')}" for sid, s in steps.items())
        wf_lines.append(f"- workflow {w['id']} ({w['name']}): {step_desc}")

    claim_lines = "\n".join(
        f"- id={c['id']} [{c['tag'] or 'untagged'}/{c['topic']}] {c['claim_text']}"
        + (f" | quote: \"{c['evidence_quote']}\"" if c["evidence_quote"] else "")
        for c in claims
    )
    content = (
        f"# Records (your only source of truth)\n{claim_lines}\n\n"
        f"# Mapped workflows and their steps\n" + ("\n".join(wf_lines) or "(none mapped yet)")
    )

    data = await run_agent_json("automation_assessor", content, workspace_id=workspace_id)

    kept = []
    for opp in data.get("opportunities") or []:
        cited = [cid for cid in (opp.get("claim_ids") or []) if str(cid) in valid_ids]
        if not cited:
            # Kaan (e): no opportunity may cite zero records — dropped, loudly.
            log.warning("automation: dropped uncited opportunity %r for %s",
                        opp.get("title"), workspace_id)
            continue
        wf_id = str(opp.get("workflow_id")) if opp.get("workflow_id") else None
        steps = workflows.get(wf_id or "", {})
        if wf_id not in workflows:
            wf_id, step_ids = None, []
        else:
            step_ids = [sid for sid in (opp.get("step_ids") or []) if str(sid) in steps]
        roi = opp.get("roi") if isinstance(opp.get("roi"), dict) else None
        if roi is not None:
            roi = {
                "assumption": str(roi.get("assumption") or "").strip(),
                "low_hours_month": roi.get("low_hours_month"),
                "high_hours_month": roi.get("high_hours_month"),
                "duration_claim_ids": [
                    cid for cid in (roi.get("duration_claim_ids") or []) if str(cid) in valid_ids
                ],
                "is_estimate": True,  # structural: ROI can never masquerade as fact
            }
            if not roi["assumption"]:
                roi = None  # an estimate without its assumptions is not honest — drop it
        signals = [s for s in (opp.get("signals") or []) if s in _SIGNALS]
        title = (opp.get("title") or "").strip()
        summary = (opp.get("summary") or "").strip()
        if not title or not summary:
            continue
        kept.append({
            "title": title[:200], "summary": summary[:600], "signals": signals,
            "claim_ids": cited, "workflow_id": wf_id, "step_ids": step_ids, "roi": roi,
        })

    async with pool.acquire() as conn, conn.transaction():
        batch = (await conn.fetchval(
            "select coalesce(max(render_batch), 0) + 1 from automation_opportunities "
            "where workspace_id = $1", workspace_id)) or 1
        # Latest batch is the truth the UI serves; prior batches stay as history.
        for k in kept:
            await conn.execute(
                """insert into automation_opportunities
                     (workspace_id, title, summary, signals, claim_ids, workflow_id, step_ids, roi, render_batch)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                workspace_id, k["title"], k["summary"], json.dumps(k["signals"]),
                json.dumps(k["claim_ids"]), k["workflow_id"], json.dumps(k["step_ids"]),
                json.dumps(k["roi"]) if k["roi"] else None, batch,
            )
    log.info("automation: stored %d opportunity(ies) for %s", len(kept), workspace_id)


@handles("assess_automation")
async def _assess_automation_job(payload: dict) -> None:
    await assess_automation(payload)
