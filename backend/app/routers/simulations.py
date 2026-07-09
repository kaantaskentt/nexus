"""Simulations surface backend (task #28 + F8 role-play).

Read endpoint: the proving history (cast + judged rounds) the Simulations page renders
above a workspace's own eval runs. Data lives in app/simulation_history.py — versioned
with the code, sourced only from judged matrix runs (evals/e2e/proof-matrix.md).
Admin-gated by the blanket dependency in main.py.

F8 role-play (marathon July 8/9): "Jump in as the employee" — the ADMIN plays a cast
character against the real interviewer, then gets an observation debrief. NOTE the
distinction from the parked Run button: that proposal spawns an AI respondent and stays
PROPOSED (park note July 8); role-play spawns NOTHING — the human admin is the
respondent, which Kaan ordered built tonight. roleplay sessions are voice_test-class:
compile and disclosure screening skip them, they never list as interviews."""

import json
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_pool
from ..pipeline.roleplay import CAST_KEYS, persona_sheet
from ..queue import enqueue
from ..simulation_history import SIMULATION_CAST, SIMULATION_ROUNDS

router = APIRouter()


@router.get("/history")
async def simulation_history():
    return {"cast": SIMULATION_CAST, "rounds": SIMULATION_ROUNDS}


# ── F8 role-play ─────────────────────────────────────────────────────────────

class RolePlayIn(BaseModel):
    persona_key: str


@router.post("/{workspace_id}/roleplay")
async def start_roleplay(workspace_id: str, body: RolePlayIn):
    """Mint a role-play session: the admin takes the interview AS the chosen character.
    voice_test-class firewall (session_kind='roleplay'); the persona key rides in
    resumable_state so the debrief knows which sheet to judge against."""
    if body.persona_key not in CAST_KEYS:
        raise HTTPException(422, "unknown persona")
    pool = await get_pool()
    if await pool.fetchval("select 1 from workspaces where id = $1", workspace_id) is None:
        raise HTTPException(404, "workspace not found")
    token = secrets.token_urlsafe(24)
    await pool.execute(
        """insert into interview_sessions
             (workspace_id, modality, language, invite_token, status, session_kind, resumable_state)
           values ($1, 'voice', 'en', $2, 'pending', 'roleplay', $3)""",
        workspace_id, token, json.dumps({"roleplay_persona": body.persona_key}),
    )
    return {"token": token, "invite_path": f"/i/{token}"}


@router.get("/roleplay/personas/{key}/brief")
async def roleplay_brief(key: str):
    """The playable character sheet (scorer notes INCLUDED — the human player must know
    what to hold back and which baits to drop). Admin-only surface by router gate."""
    sheet = persona_sheet(key, include_scorer=True)
    if sheet is None:
        raise HTTPException(404, "unknown persona")
    cast = next((c for c in SIMULATION_CAST if c["key"] == key), None)
    return {"key": key, "cast": cast, "sheet": sheet}


@router.get("/{workspace_id}/roleplay")
async def list_roleplay(workspace_id: str):
    """Past role-play runs, newest first, with debrief state for the section list."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select s.id, s.status, s.created_at, s.resumable_state,
                  d.document, d.generated_at,
                  (select count(*) from utterances u where u.session_id = s.id) as turns
           from interview_sessions s
           left join roleplay_debriefs d on d.session_id = s.id
           where s.workspace_id = $1 and s.session_kind = 'roleplay'
           order by s.created_at desc""",
        workspace_id,
    )
    out = []
    for r in rows:
        state = r["resumable_state"]
        state = json.loads(state) if isinstance(state, str) else (state or {})
        doc = r["document"]
        out.append({
            "session_id": str(r["id"]),
            "persona_key": (state or {}).get("roleplay_persona"),
            "status": r["status"],
            "turns": r["turns"],
            "created_at": r["created_at"].isoformat(),
            "debrief": (json.loads(doc) if isinstance(doc, str) else doc) if doc else None,
            "debrief_generated_at": r["generated_at"].isoformat() if r["generated_at"] else None,
        })
    return out


@router.post("/roleplay/{session_id}/debrief")
async def request_debrief(session_id: str):
    """Enqueue the observation debrief for a finished role-play. Idempotent: an existing
    debrief returns ready without re-running."""
    pool = await get_pool()
    session = await pool.fetchrow(
        "select session_kind from interview_sessions where id = $1", session_id
    )
    if session is None or session["session_kind"] != "roleplay":
        raise HTTPException(404, "no such role-play session")
    if await pool.fetchval("select 1 from roleplay_debriefs where session_id = $1", session_id):
        return {"status": "ready"}
    turns = await pool.fetchval(
        "select count(*) from utterances where session_id = $1", session_id
    )
    if turns < 4:
        raise HTTPException(422, "this run is too short to debrief; take the interview first")
    job_id = await enqueue("roleplay_debrief", {"session_id": session_id})
    return {"status": "queued", "job_id": job_id}
