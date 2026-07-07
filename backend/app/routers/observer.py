"""Observer view backend (A19) — the admin's live window onto one interview session.

Sources: docs/MERGE_PLAN.md A19 (Observer = same elements as the respondent room inside
the admin shell: transcript, insight cards, topics ring, Add insight) and its corrections.

Two endpoints, both admin-gated by the blanket dependency in main.py:

- GET  /api/observer/{workspace_id}/sessions/{session_id}          — one poll of live state
- POST /api/observer/{workspace_id}/sessions/{session_id}/insights — the Add-insight button

Honesty contract (correction #1): everything returned here is REAL stored state — verbatim
utterances from the transcript store, the coverage map the turn engine actually computed
(None when coverage_routing is off; the UI says so instead of faking a ring), observer
insights pinned to CLAIMED at the data layer (0010), and post-compile claim_records with
their true tags. Nothing is synthesized for display; the frontend maps tags to badges only
through trust.ts/confidenceForTag.
"""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings
from ..db import get_pool

router = APIRouter()


async def _session_row(pool, workspace_id: str, session_id: str):
    """The session, scoped to the workspace so a valid session id from another tenant is
    a 404 here (same isolation posture as every other admin route)."""
    row = await pool.fetchrow(
        """select s.id, s.status, s.modality, s.started_at, s.created_at, s.resumable_state,
                  coalesce(se.canonical_name, pe.canonical_name) as interviewee,
                  coalesce(se.role, pe.role) as interviewee_role
           from interview_sessions s
           left join entities se on se.id = s.interviewee_id
           left join interview_plans p on p.id = s.plan_id
           left join entities pe on pe.id = p.interviewee_id
           where s.id = $1 and s.workspace_id = $2""",
        session_id, workspace_id,
    )
    if row is None:
        raise HTTPException(404, "session not found")
    return row


def _state(resumable_state) -> dict:
    state = resumable_state
    if isinstance(state, str):
        try:
            state = json.loads(state)
        except (ValueError, TypeError):
            state = None
    return state if isinstance(state, dict) else {}


@router.get("/{workspace_id}/sessions/{session_id}")
async def observe_session(workspace_id: str, session_id: str):
    pool = await get_pool()
    sess = await _session_row(pool, workspace_id, session_id)

    utterances = await pool.fetch(
        """select turn_index, speaker, text, created_at from utterances
           where session_id = $1 order by turn_index""",
        session_id,
    )
    insights = await pool.fetch(
        """select id, text, trust_tag, created_at from observer_insights
           where session_id = $1 order by created_at""",
        session_id,
    )
    # Post-compile record: present once the session compiled (claim_records carry the
    # REAL per-claim tags; the ladder decides the badge on the frontend, never this route).
    claims = await pool.fetch(
        """select id, claim_text, tag, evidence_quote, created_at from claim_records
           where session_id = $1 and quarantined = false
           order by created_at""",
        session_id,
    )

    state = _state(sess["resumable_state"])
    return {
        "session": {
            "id": str(sess["id"]),
            "status": sess["status"],
            "modality": sess["modality"],
            "started_at": sess["started_at"].isoformat() if sess["started_at"] else None,
            "interviewee": sess["interviewee"],
            "interviewee_role": sess["interviewee_role"],
        },
        "utterances": [
            {"turn_index": u["turn_index"], "speaker": u["speaker"], "text": u["text"],
             "at": u["created_at"].isoformat()}
            for u in utterances
        ],
        # Objectives the interviewer is working from + the coverage map the engine actually
        # computed. coverage is None whenever the tracker didn't run (flag off / no turns
        # yet / fail-open) — the UI must render "not tracked", never an empty-but-green ring.
        "objectives": state.get("objectives") or [],
        "coverage": state.get("coverage"),
        "coverage_tracking_enabled": get_settings().coverage_routing,
        "insights": [
            {"id": i["id"], "text": i["text"], "trust_tag": i["trust_tag"],
             "at": i["created_at"].isoformat()}
            for i in insights
        ],
        "claims": [
            {"id": str(c["id"]), "text": c["claim_text"], "tag": c["tag"],
             "evidence_quote": c["evidence_quote"], "at": c["created_at"].isoformat()}
            for c in claims
        ],
    }


class InsightIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/{workspace_id}/sessions/{session_id}/insights")
async def add_insight(workspace_id: str, session_id: str, body: InsightIn):
    """The Add-insight button. Stored as CLAIMED — a live, single-voice, uncorroborated
    note — and the 0010 check makes any stronger tag a DB error, not a prompt-discipline
    hope. Compile-time corroboration happens in claim_records, never by editing this row."""
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "empty insight")
    pool = await get_pool()
    await _session_row(pool, workspace_id, session_id)  # 404 before insert on bad scope
    row = await pool.fetchrow(
        """insert into observer_insights (session_id, text)
           values ($1, $2) returning id, text, trust_tag, created_at""",
        session_id, text,
    )
    return {"id": row["id"], "text": row["text"], "trust_tag": row["trust_tag"],
            "at": row["created_at"].isoformat()}
