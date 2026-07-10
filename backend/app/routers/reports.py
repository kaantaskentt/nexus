"""Post-Interview Report data (Stage 8) — the frontend report screens render from
this. Everything traces to records and goes through client_visible_claims, so
quarantined content can never surface. Perception gaps appear ONLY here (F27), never
on the live snapshot."""

from fastapi import APIRouter

from ..db import get_pool, loads

router = APIRouter()


_TOOL_KIND = {"whatsapp": "whatsapp", "excel": "excel", "spreadsheet": "excel",
              "shopify": "shopify", "printer": "printer", "notion": "notion",
              "apify": "apify", "email": "email"}
_STEP_STATUS = {"verified": "verified", "partial": "partial", "unverified": "needs_clarification"}
_STEP_CONF = {"verified": "verified", "partial": "reported", "unverified": "scraped"}


def _tool_kind(name: str | None) -> str:
    n = (name or "").lower()
    return next((v for k, v in _TOOL_KIND.items() if k in n), "unknown")


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
        # One lookup for the paraphrase + who-it-came-from behind each step (F33: the
        # client view shows the compiler's third-person paraphrase, never a verbatim
        # employee quote).
        all_ids = [str(c) for s in steps for c in s["claim_ids"]]
        claim_map = {}
        if all_ids:
            crows = await pool.fetch(
                "select c.id, c.claim_text, e.canonical_name as speaker from claim_records c "
                "left join entities e on e.id = c.speaker_id where c.id = any($1::uuid[])", all_ids)
            claim_map = {str(r["id"]): r for r in crows}

        def _step(s):
            spine = loads(s["spine_slots"]) or {}
            scores = loads(s["slot_scores"]) or {}
            ids = [str(c) for c in s["claim_ids"]]
            texts = [claim_map[i]["claim_text"] for i in ids if i in claim_map]
            speakers = [claim_map[i]["speaker"] for i in ids if claim_map.get(i) and claim_map[i]["speaker"]]
            return {
                "index": s["step_index"],
                "title": spine.get("task") or (s["action"] or "Step")[:60],
                "description": s["action"],
                "tool": {"kind": _tool_kind(s["tool"]), "name": s["tool"] or "—"},
                "input": s["input"], "action": s["action"], "output": s["output"],
                "status": _STEP_STATUS.get(s["verified"], "needs_clarification"),
                "confidence": _STEP_CONF.get(s["verified"], "reported"),
                "captured_from": speakers[0] if speakers else None,
                "captured_paraphrase": " ".join(texts) or None,
                "unverified_questions": [f"{slot.replace('_', ' ').capitalize()} not yet captured"
                                         for slot, sc in scores.items() if sc == 0],
                "spine_slots": spine, "slot_scores": scores, "claim_ids": ids,
            }

        workflow = {"name": wf["name"], "steps": [_step(s) for s in steps]}

    # Perception gaps + conflict points — both claim sides via the deny-by-default view.
    # A gap BELONGS to this session's compile if at least one side came from this
    # interview (the other side may legitimately be a prior/cross-session record).
    conflict_rows = await pool.fetch(
        """select k.id, k.kind, k.status, k.resolution,
                  a.claim_text as claim_a, a.tag as tag_a,
                  b.claim_text as claim_b, b.tag as tag_b
           from claim_conflicts k
           join client_visible_claims a on a.id = k.claim_a_id
           join client_visible_claims b on b.id = k.claim_b_id
           where k.workspace_id = $1
             and ($2::uuid in (a.session_id, b.session_id))""",
        workspace_id, session_id,
    )
    conflicts = [
        {"id": str(r["id"]), "kind": r["kind"], "status": r["status"],
         "resolution": loads(r["resolution"]),
         "claim_a": {"text": r["claim_a"], "tag": r["tag_a"]},
         "claim_b": {"text": r["claim_b"], "tag": r["tag_b"]}}
        for r in conflict_rows
    ]
    perception_gaps = [c for c in conflicts if c["kind"] == "perception_gap"]

    # Key findings — pains (with band) + CONFIRMED facts from THIS interview only
    # (a report is one interview's findings; workspace scope floods it with other
    # sessions' records — the multi-interview coherence bug).
    finding_rows = await pool.fetch(
        """select c.claim_text, c.topic, c.tag, c.evidence_quote, p.band
           from client_visible_claims c
           left join pain_scores p on p.claim_id = c.id
           where c.session_id = $1 and (c.topic = 'pain' or c.tag = 'CONFIRMED')
           order by case c.topic when 'pain' then 0 else 1 end, c.created_at
           limit 20""",
        session_id,
    )
    key_findings = [
        {"text": r["claim_text"], "topic": r["topic"], "tag": r["tag"],
         "evidence": r["evidence_quote"], "pain_band": r["band"]}
        for r in finding_rows
    ]

    # Follow-up — stated unknowns (admissions) + INTERVIEW-OBJECTIVE triggers from
    # THIS interview only.
    followup_rows = await pool.fetch(
        """select claim_text, kind, provenance from client_visible_claims
           where session_id = $1 and (kind = 'admission' or provenance::text ilike '%INTERVIEW-OBJECTIVE%')""",
        session_id,
    )
    follow_up_on = []
    for r in followup_rows:
        prov = loads(r["provenance"]) or {}
        objectives = [t for t in prov.get("triggers", []) if "INTERVIEW-OBJECTIVE" in t]
        follow_up_on.append({"text": r["claim_text"], "kind": r["kind"], "objectives": objectives})

    quality = (loads(session["resumable_state"]) or {}).get("interview_quality")
    if quality and isinstance(quality.get("objectives"), list):
        from collections import Counter
        counts = Counter(o.get("outcome") for o in quality["objectives"])
        quality["counts"] = {k: counts.get(k, 0)
                             for k in ("satisfied", "partial", "dodged", "untouched")}

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
