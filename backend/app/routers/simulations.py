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
from ..pipeline import scenario as scenario_mod
from ..pipeline import workflow_edit
from ..pipeline.roleplay import CAST_KEYS, persona_sheet
from ..queue import enqueue
from ..simulation_history import SIMULATION_CAST, SIMULATION_ROUNDS
from .workflows import _derive_confidence

router = APIRouter()


def _join_and(parts: list[str]) -> str:
    if len(parts) <= 1:
        return parts[0] if parts else ""
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def _scenario_summary(label, steps, has_exceptions, has_decisions, confidence) -> str:
    """Display prose for a scenario card — a template filled from the workflow's own
    attributes, so it never leaks another company's example. This is the card copy only;
    the interviewer's steering objectives are derived separately server-side in lane-e's
    mint (locked contract), never shared with this string."""
    facts = [f"{steps} steps"]
    if has_exceptions:
        facts.append("documented exceptions")
    if has_decisions:
        facts.append("decision points")
    lead = f"{label} — {_join_and(facts)}."
    tests = []
    if has_exceptions:
        tests.append("surfaces how it handles exceptions")
    if has_decisions:
        tests.append("draws out the decision logic")
    if confidence in ("low", "medium"):
        tests.append("corroborates the steps that rest on a single account")
    if not tests:
        tests.append("holds a straightforward process to real specifics")
    return f"{lead} Tests whether the interviewer {_join_and(tests)}."


@router.get("/history")
async def simulation_history():
    return {"cast": SIMULATION_CAST, "rounds": SIMULATION_ROUNDS}


@router.get("/{workspace_id}/scenarios")
async def list_scenarios(workspace_id: str):
    """Simulation scenarios derived from THIS workspace's real workflows (SIMPLIFY I).
    A workflow qualifies when it has >= 3 steps (a 1-2 step 'workflow' isn't worth a drill);
    cards are ranked by testing value — the places a real interview must dig: documented
    exceptions, decision points, and thinly-sourced (lower-confidence) steps. Display-only:
    the Run button sends only `workflow_id` to the mint, which derives the archetype +
    interviewer objectives server-side (locked contract — client-supplied objectives never
    cross the wire). Never invents a scenario from thin data; a tenant with no qualifying
    workflow gets an empty list (the page shows an honest empty state, never the global cast)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select w.id, w.name,
                  (select count(*) from workflow_steps s where s.workflow_id = w.id) as step_count,
                  (select count(*) from workflow_steps s
                     where s.workflow_id = w.id and s.verified = 'verified') as verified_count,
                  exists(select 1 from workflow_steps s where s.workflow_id = w.id
                           and coalesce(s.spine_slots->>'exceptions','') <> '') as has_exceptions,
                  exists(select 1 from workflow_steps s where s.workflow_id = w.id
                           and coalesce(s.spine_slots->>'rules','') <> '') as has_decisions
           from workflows w where w.workspace_id = $1""",
        workspace_id,
    )
    scenarios = []
    for r in rows:
        steps = r["step_count"]
        if steps < 3:
            continue
        confidence = _derive_confidence(steps, r["verified_count"])
        has_exceptions, has_decisions = r["has_exceptions"], r["has_decisions"]
        score = (2 if has_exceptions else 0) + (1 if has_decisions else 0) + \
                {"low": 2, "medium": 1}.get(confidence or "", 0)
        scenarios.append({
            "workflow_id": str(r["id"]),
            "label": r["name"],
            "step_count": steps,
            "tests_summary": _scenario_summary(r["name"], steps, has_exceptions, has_decisions, confidence),
            "signals": {
                "has_exceptions": has_exceptions,
                "has_decisions": has_decisions,
                "confidence": confidence,
            },
            "_score": score,
        })
    scenarios.sort(key=lambda s: s.pop("_score"), reverse=True)
    return scenarios


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


# ── Scenario run (SIMPLIFY I — lane-e Run wiring) ─────────────────────────────

class ScenarioRunIn(BaseModel):
    # ONLY workflow_id crosses the wire (locked contract). The archetype + the interviewer
    # objectives are derived SERVER-SIDE from the workflow — a browser-supplied objective
    # that steers the simulated interviewer would be a prompt-injection surface. pydantic
    # drops any other field in the body (no extra=allow), which is the injection guard.
    workflow_id: str


@router.post("/{workspace_id}/scenario-run")
async def scenario_run(workspace_id: str, body: ScenarioRunIn):
    """Run a scenario: derive {archetype, interviewer objectives} from the named workflow,
    mint a roleplay-kind session bound to them, and hand back the invite path to the room.
    Firewall unchanged — roleplay sessions never compile/screen/list (compiler, disclosure,
    live_capture all skip session_kind='roleplay'); nothing said here reaches client records.
    The archetype supplies WHO the admin plays; the workflow supplies WHAT the interviewer
    must draw out (no fabricated real-employee persona — SIMPLIFY-I-DESIGN LOCKED #1)."""
    pool = await get_pool()
    # Isolation: the workflow must belong to THIS workspace; a valid id from another tenant 404s.
    if await pool.fetchval(
        "select 1 from workflows where id = $1 and workspace_id = $2",
        body.workflow_id, workspace_id,
    ) is None:
        raise HTTPException(404, "no such workflow in this workspace")
    effective = await workflow_edit.effective_workflow(pool, body.workflow_id)
    # Defense in depth (the page only shows qualifying cards, but a direct call must not run
    # a 1-step "drill"): a scenario needs >= 3 visible steps.
    if scenario_mod.visible_step_count(effective) < 3:
        raise HTTPException(422, "a workflow needs at least 3 steps to pressure-test")
    scenario = scenario_mod.build_scenario(effective)
    token = secrets.token_urlsafe(24)
    await pool.execute(
        """insert into interview_sessions
             (workspace_id, modality, language, invite_token, status, session_kind, resumable_state)
           values ($1, 'voice', 'en', $2, 'pending', 'roleplay', $3)""",
        workspace_id, token,
        json.dumps({
            "roleplay_persona": scenario["persona_key"],  # top-level so the debrief finds the sheet
            "scenario": {
                "workflow_id": scenario["workflow_id"],
                "label": scenario["label"],
                "objectives": scenario["objectives"],
            },
        }),
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
