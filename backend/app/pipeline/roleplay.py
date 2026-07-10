"""Role-play debrief (F8) — the observation feedback loop for admin role-play sessions.

The admin played a fictional cast character against the real interviewer; this job reads
the verbatim transcript plus the character sheet and produces the debrief (did well /
missed / per objective). roleplay sessions are voice_test-class: they never compile,
never screen, never touch client records — this handler writes ONLY roleplay_debriefs.
"""

import json
import logging
import re

from ..config import REPO_ROOT
from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles

log = logging.getLogger("nexus.roleplay")

PERSONA_DIR = REPO_ROOT / "prompts" / "personas" / "respondents"

# The playable cast (client-safe summaries live in app/simulation_history.py; the sheet
# an admin plays from is the full respondent persona file).
CAST_KEYS = [
    "jewelry-ops-manager",
    "hotel-frontdesk-lead",
    "agency-account-manager",
    "bookkeeper",
    "warehouse-foreman",
]

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


def persona_sheet(key: str, *, include_scorer: bool = False) -> str | None:
    """The character sheet. For the ADMIN's playing brief the scorer notes stay in
    (the human player must know what to hold back); repo-annotation comments that are
    not scorer notes are stripped for readability. Returns None for an unknown key."""
    if key not in CAST_KEYS:
        return None
    path = PERSONA_DIR / f"{key}.md"
    if not path.exists():
        return None
    text = path.read_text()
    if not include_scorer:
        text = _HTML_COMMENT.sub("", text)
    return text.strip()


def _build_content(sheet: str, transcript: str, objectives: list[str] | None = None) -> str:
    # Instruction last, after the transcript (quality.py precedent: instruction-after-
    # transcript prevents the transcript-echo failure observed on prod).
    scenario_block = ""
    if objectives:
        # SIMPLIFY I: a workflow-scenario run. Judge objective coverage ALONGSIDE the usual
        # craft judging — did the interviewer surface each thing this workflow was set to test.
        obj_lines = "\n".join(f"- {o}" for o in objectives)
        scenario_block = (
            "\n\n# Scenario objectives the interviewer was steered to cover (SIMULATION)\n"
            "This run pressure-tested a real workflow. Beyond the usual craft judging, assess "
            "whether the interviewer covered each objective below: name which it surfaced and "
            "which it missed, with evidence from the transcript.\n" + obj_lines
        )
    return (
        "# Character sheet the human played (ground truth + hidden layers + style test)\n"
        + sheet
        + "\n\n# Role-play transcript to observe (INPUT, do not echo or continue it)\n"
        + transcript
        + scenario_block
        + "\n\n# Task\nWrite the observation debrief of the INTERVIEWER's craft per your "
        "instructions. Respond with ONLY the single JSON object specified. Do not repeat, "
        "echo, or continue the transcript."
    )


@handles("roleplay_debrief")
async def generate_roleplay_debrief(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    session = await pool.fetchrow(
        "select session_kind, resumable_state from interview_sessions where id = $1",
        session_id,
    )
    if session is None or session["session_kind"] != "roleplay":
        log.info("roleplay_debrief: %s is not a roleplay session — skipping", session_id)
        return
    if await pool.fetchval(
        "select 1 from roleplay_debriefs where session_id = $1", session_id
    ):
        return  # idempotent — one debrief per run

    state = session["resumable_state"]
    state = json.loads(state) if isinstance(state, str) else (state or {})
    persona_key = (state or {}).get("roleplay_persona")
    sheet = persona_sheet(persona_key, include_scorer=True) if persona_key else None
    if sheet is None:
        log.warning("roleplay_debrief: %s has no resolvable persona — skipping", session_id)
        return

    utterances = await pool.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index",
        session_id,
    )
    if len(utterances) < 4:
        log.info("roleplay_debrief: %s too short to judge (%d turns) — skipping",
                 session_id, len(utterances))
        return
    transcript = "\n".join(f"[{u['speaker']}] {u['text']}" for u in utterances)
    objectives = ((state or {}).get("scenario") or {}).get("objectives")

    result = await run_agent_json(
        "roleplay_debrief", _build_content(sheet, transcript, objectives),
        session_id=str(session_id),
    )
    await pool.execute(
        """insert into roleplay_debriefs (session_id, persona_key, document)
           values ($1, $2, $3) on conflict (session_id) do nothing""",
        session_id, persona_key, json.dumps(result),
    )
    log.info("roleplay_debrief: stored for %s (%s)", session_id, persona_key)
