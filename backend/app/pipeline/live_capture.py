"""Live capture extractor (SIMPLIFY E) — the honest engine behind the "Captured live"
panel. After each committed RESPONDENT turn, a lightweight job reads that turn's words
(the delta) plus the running capture list and writes STRUCTURAL items only: teams,
systems, workflow mentions, decision rules, goals, open questions.

What this is NOT: a claim producer. These rows are session-scoped DISPLAY data. They never
enter the Knowledge Base — the Stage-4 compiler stays the ONLY producer of claim_records
(non-negotiable #1). Three guards hold at the data layer, not by prompt discipline alone:

  * no-invention — every item must quote a verbatim span from the delta, or it is dropped;
  * quarantine  — an item carrying sentiment / an evaluative judgment about a person is
    dropped before insert (non-negotiable #4);
  * dedup       — an item already captured this session (any wording) is dropped.

The extractor is fired only for real 'interview'/'context' sessions; eval, voice_test, and
roleplay kinds never spawn it (firewall backstop).
"""

import logging
import re

from ..db import get_pool
from ..llm import AgentParseError, run_agent_json
from ..queue import enqueue, handles

log = logging.getLogger("nexus.live_capture")

_LIVE_KINDS = {"team", "system", "workflow", "decision_rule", "goal", "open_question"}
_CAPTURE_KINDS = ("interview", "context")  # the only kinds that get a live panel

# Data-layer quarantine backstop (non-negotiable #4). Structural items never carry an
# evaluative judgment; if the model slips one through, these markers catch it and the item
# is dropped before it can reach the panel. The prompt is the first line of defence; this
# is the one that does not depend on the model behaving.
_EVALUATIVE = re.compile(
    r"\b("
    r"lazy|incompeten\w*|useless|hopeless|brilliant|amazing|terrible|awful|toxic|rude|"
    r"unreliable|disorganiz\w*|disorganis\w*|sloppy|careless|slow(?:er|est)?|"
    r"(?:in)?competent|(?:un)?professional|difficult|annoying|hate[sd]?|love[sd]?|"
    r"is good at|is bad at|not good|no good|the best|the worst|great at|bad at|"
    r"stupid|smart|genius|idiot\w*|nightmare|a pain|dead ?weight"
    r")\b",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def _supported(item: dict, delta: str) -> bool:
    """No-invention: the item's quote must be a verbatim span of THIS respondent turn.
    Normalized (whitespace/case) substring match — the model copies the span, small
    transcription-style differences are not what we are guarding against; a fabricated
    item that quotes something never said is."""
    quote = _norm(item.get("quote", ""))
    if len(quote) < 4:
        return False
    return quote in _norm(delta)


def _quarantined(item: dict) -> bool:
    """Drop any item that carries an evaluative judgment (non-negotiable #4). Structural
    facts do not need evaluative language; if it is present, the item is not structural."""
    blob = f"{item.get('label', '')} {item.get('detail', '')}"
    return bool(_EVALUATIVE.search(blob))


def _is_dup(item: dict, seen: set[tuple[str, str]]) -> bool:
    return (item.get("kind", ""), _norm(item.get("label", ""))) in seen


def _build_content(question: str | None, delta: str, existing: list[dict]) -> str:
    running = (
        "\n".join(f"- [{e['kind']}] {e['label']}" for e in existing)
        if existing else "(nothing captured yet)"
    )
    q = question or "(this is the opening; no prior question)"
    # Instruction-after-input (quality.py / roleplay.py precedent: it prevents the
    # transcript-echo failure seen on prod).
    return (
        "# Interviewer's last question (context only — do NOT extract from this)\n"
        f"{q}\n\n"
        "# Already captured this session (do NOT repeat any of these)\n"
        f"{running}\n\n"
        "# Newest respondent turn (THE DELTA — extract ONLY from these words)\n"
        f"{delta}\n\n"
        "# Task\nReturn ONLY the JSON array of new structural items per your instructions. "
        "Every item needs a verbatim quote from the delta. Emit nothing evaluative about a "
        "person. An empty array is the right answer when the turn has no new structure."
    )


async def enqueue_extraction(session_id: str, turn_index: int) -> None:
    """Fire-and-forget from a committed respondent turn. Batch priority (100): the live
    panel is display data and must never sit ahead of an interview turn in the queue."""
    await enqueue("extract_live_captures", {"session_id": str(session_id), "turn_index": turn_index})


async def extraction_in_flight(pool, session_id: str) -> bool:
    """Real signal for the panel's 'Saving' state: is an extraction job queued or running
    for this session right now. Derived from the jobs table — never a faked UI state."""
    return bool(await pool.fetchval(
        """select 1 from jobs
           where kind = 'extract_live_captures' and status in ('queued', 'running')
             and payload->>'session_id' = $1 limit 1""",
        str(session_id),
    ))


@handles("extract_live_captures")
async def extract_live_captures(payload: dict) -> None:
    session_id = payload["session_id"]
    turn_index = payload["turn_index"]
    pool = await get_pool()

    session = await pool.fetchrow(
        "select workspace_id, session_kind from interview_sessions where id = $1", session_id
    )
    if session is None or session["session_kind"] not in _CAPTURE_KINDS:
        return  # firewall backstop: eval/voice_test/roleplay never get a live panel

    delta = await pool.fetchval(
        "select text from utterances where session_id = $1 and turn_index = $2 and speaker = 'respondent'",
        session_id, turn_index,
    )
    if not delta:
        return  # the target turn is not a respondent turn (e.g. the agent opener)
    question = await pool.fetchval(
        "select text from utterances where session_id = $1 and turn_index = $2 and speaker = 'agent'",
        session_id, turn_index - 1,
    )

    existing = [
        dict(r) for r in await pool.fetch(
            "select kind, label from live_captures where session_id = $1", session_id
        )
    ]

    try:
        items = await run_agent_json(
            "live_capture_extractor",
            _build_content(question, delta, existing),
            workspace_id=str(session["workspace_id"]),
            session_id=str(session_id),
        )
    except AgentParseError:
        # Display data: a malformed extraction shows nothing (honest) rather than failing
        # and retrying the same turn. The raw output is on the agent_runs audit row.
        log.warning("live_capture: unparseable extraction for session %s turn %s — skipping",
                    session_id, turn_index)
        return
    if not isinstance(items, list):
        return

    seen = {(e["kind"], _norm(e["label"])) for e in existing}
    kept = 0
    for item in items:
        if not isinstance(item, dict) or item.get("kind") not in _LIVE_KINDS:
            continue
        if not item.get("label"):
            continue
        if not _supported(item, delta):
            log.info("live_capture: dropped unsupported (no verbatim quote) item %r", item.get("label"))
            continue
        if _quarantined(item):
            log.info("live_capture: quarantined evaluative item %r", item.get("label"))
            continue
        if _is_dup(item, seen):
            continue
        await pool.execute(
            """insert into live_captures (session_id, workspace_id, kind, label, detail, status)
               values ($1, $2, $3, $4, $5, 'saved')""",
            session_id, session["workspace_id"], item["kind"], item["label"],
            (item.get("detail") or None),
        )
        seen.add((item["kind"], _norm(item["label"])))
        kept += 1
    if kept:
        log.info("live_capture: session %s turn %s captured %d item(s)", session_id, turn_index, kept)
