"""Post-Interview Report data (Stage 8) — the frontend report screens render from
this. Everything traces to records and goes through client_visible_claims, so
quarantined content can never surface. Perception gaps appear ONLY here (F27), never
on the live snapshot."""

import json

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


def _loads(v):
    return json.loads(v) if isinstance(v, str) else v


@router.get("/by-plan/{plan_id}")
async def report_by_plan(plan_id: str):
    """Resolve a plan to its compiled interview session, then render its report — the
    Plan page links straight here without having to know the session id."""
    pool = await get_pool()
    sid = await pool.fetchval(
        "select id from interview_sessions where plan_id = $1 and status = 'completed' "
        "order by ended_at desc nulls last limit 1",
        plan_id,
    )
    if sid is None:
        return {"error": "no compiled session for this plan yet"}
    return await report(str(sid))


@router.get("/{session_id}")
async def report(session_id: str):
    pool = await get_pool()
    session = await pool.fetchrow(
        "select id, workspace_id, resumable_state from interview_sessions where id = $1",
        session_id,
    )
    if session is None:
        return {"error": "session not found"}
    workspace_id = session["workspace_id"]

    # Workflow canvas — latest workflow for the session + ordered steps.
    workflow = None
    wf = await pool.fetchrow(
        "select id, name from workflows where session_id = $1 order by created_at desc limit 1",
        session_id,
    )
    if wf:
        steps = await pool.fetch(
            """select step_index, action, tool, input, output, verified, spine_slots, slot_scores, claim_ids
               from workflow_steps where workflow_id = $1 order by step_index""",
            wf["id"],
        )
        workflow = {
            "name": wf["name"],
            "steps": [
                {**dict(s), "spine_slots": _loads(s["spine_slots"]),
                 "slot_scores": _loads(s["slot_scores"]), "claim_ids": [str(c) for c in s["claim_ids"]]}
                for s in steps
            ],
        }

    # Perception gaps + conflict points — both claim sides via the deny-by-default view.
    conflict_rows = await pool.fetch(
        """select k.id, k.kind, k.status, k.resolution,
                  a.claim_text as claim_a, a.tag as tag_a,
                  b.claim_text as claim_b, b.tag as tag_b
           from claim_conflicts k
           join client_visible_claims a on a.id = k.claim_a_id
           join client_visible_claims b on b.id = k.claim_b_id
           where k.workspace_id = $1""",
        workspace_id,
    )
    conflicts = [
        {"id": str(r["id"]), "kind": r["kind"], "status": r["status"],
         "resolution": _loads(r["resolution"]),
         "claim_a": {"text": r["claim_a"], "tag": r["tag_a"]},
         "claim_b": {"text": r["claim_b"], "tag": r["tag_b"]}}
        for r in conflict_rows
    ]
    perception_gaps = [c for c in conflicts if c["kind"] == "perception_gap"]

    # Key findings — pains (with band) + CONFIRMED facts, traceable to evidence.
    finding_rows = await pool.fetch(
        """select c.claim_text, c.topic, c.tag, c.evidence_quote, p.band
           from client_visible_claims c
           left join pain_scores p on p.claim_id = c.id
           where c.workspace_id = $1 and (c.topic = 'pain' or c.tag = 'CONFIRMED')
           order by case c.topic when 'pain' then 0 else 1 end, c.created_at
           limit 20""",
        workspace_id,
    )
    key_findings = [
        {"text": r["claim_text"], "topic": r["topic"], "tag": r["tag"],
         "evidence": r["evidence_quote"], "pain_band": r["band"]}
        for r in finding_rows
    ]

    # Follow-up — stated unknowns (admissions) + INTERVIEW-OBJECTIVE triggers.
    followup_rows = await pool.fetch(
        """select claim_text, kind, provenance from client_visible_claims
           where workspace_id = $1 and (kind = 'admission' or provenance::text ilike '%INTERVIEW-OBJECTIVE%')""",
        workspace_id,
    )
    follow_up_on = []
    for r in followup_rows:
        prov = _loads(r["provenance"]) or {}
        objectives = [t for t in prov.get("triggers", []) if "INTERVIEW-OBJECTIVE" in t]
        follow_up_on.append({"text": r["claim_text"], "kind": r["kind"], "objectives": objectives})

    quality = (_loads(session["resumable_state"]) or {}).get("interview_quality")

    return {
        "session_id": str(session["id"]),
        "workspace_id": str(workspace_id),
        "workflow": workflow,
        "perception_gaps": perception_gaps,   # F27: report-only surface
        "conflict_points": conflicts,
        "key_findings": key_findings,
        "follow_up_on": follow_up_on,
        "interview_quality": quality,
    }
