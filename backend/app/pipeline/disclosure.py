"""Disclosure screen — Tier-2 sealed flags at the data layer (Emre stage-7 §7, A24 ADOPT).

One pass over a completed session's verbatim transcript, screening for Tier-2 allegations
(harassment / discrimination / safety / illegality), Tier-3 imminent-harm moments, and the
abrupt-quit-after-a-sensitive-moment signal. Hits become rows in sealed_flags — a table
deliberately OUTSIDE the record store: nothing here references claim_records, no client-
facing route serves it, and no compile / conflict / snapshot / report path reads it.
Review is a Nexus-team human act (Emre), case by case.

Runs beside compile_session, not inside it, so a failed compile never skips the screen.
Fail-loud: unparseable screen output raises (job retries); a silent drop here would be a
silently broken promise to the respondent.

Tier-3 protocol is OPEN (Emre's dedicated pass + Kaan confirmation) — this module only
records the flag; the interviewer-side stub stops-and-routes, it never handles."""

import json
import logging
import re

from ..db import get_pool
from ..llm import AgentParseError, run_agent
from ..queue import handles
from .compiler import _transcript_block

log = logging.getLogger("nexus.disclosure")

_ALLOWED_CATEGORIES = {
    "harassment", "discrimination", "safety", "illegality",
    "imminent_harm", "abrupt_quit_after_sensitive", "other",
}


def _bucket_for_tier(tier: int) -> str:
    """Section 7 coarse bucket. The agent recognizes coarsely; the reviewer assigns the
    final tier (§7.5). tier 3 (danger to life) -> red; tier 2 (serious harm / wrongdoing)
    -> amber. The screen never emits a lower tier, so yellow is reserved for the schema."""
    return "red" if tier == 3 else "amber"


def parse_screen_output(text: str) -> list[dict]:
    """Tolerant JSON-array extraction; validates tiers/categories so a malformed flag
    fails loud instead of landing half-formed in the review queue."""
    m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    blob = m.group(1) if m else None
    if blob is None:
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1:
            raise ValueError("disclosure screen returned no JSON array")
        blob = text[start : end + 1]
    flags = json.loads(blob)
    if not isinstance(flags, list):
        raise ValueError("disclosure screen output is not a list")
    for f in flags:
        if f.get("tier") not in (2, 3):
            raise ValueError(f"flag tier must be 2 or 3, got {f.get('tier')!r}")
        if f.get("category") not in _ALLOWED_CATEGORIES:
            raise ValueError(f"unknown flag category {f.get('category')!r}")
        if not f.get("reviewer_summary"):
            raise ValueError("flag missing reviewer_summary")
    return flags


async def screen_session(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    session = await pool.fetchrow(
        "select id, workspace_id, session_kind from interview_sessions where id = $1", session_id
    )
    if session is None:
        # Session deleted before this queued job ran (admin delete). A gone session is a
        # terminal no-op, not a retryable crash — same stance as generate_roleplay_debrief.
        log.info("screen_disclosures: session %s is gone — skipping", session_id)
        return
    if session["session_kind"] in ("voice_test", "roleplay"):
        return  # admin auditioning a voice / playing a character (F8) — nothing to screen
    # Idempotent: a session is screened once; a re-complete never duplicates flags.
    existing = await pool.fetchval(
        "select count(*) from sealed_flags where session_id = $1", session_id
    )
    if existing:
        return
    utterances = [
        dict(u) for u in await pool.fetch(
            "select turn_index, speaker, text from utterances "
            "where session_id = $1 order by turn_index",
            session_id,
        )
    ]
    if not utterances:
        return
    raw = await run_agent(
        "disclosure_screen",
        "# Transcript to screen\n\n" + _transcript_block(utterances),
        workspace_id=str(session["workspace_id"]),
        session_id=session_id,
        max_tokens=2000,
    )
    try:
        flags = parse_screen_output(raw)
    except (ValueError, json.JSONDecodeError) as e:
        raise AgentParseError(f"disclosure_screen output not parseable: {e}") from e
    # Sealed flag (fuller, reviewer_summary for the Tier-2 flow) AND the Section-7
    # minimized incident record are written together in one transaction, so a flag never
    # exists without its incident. The incident holds ONLY {category, bucket, timestamp,
    # session_ref} — no verbatim (§7.6). notify_status stays 'pending' here; the reviewer
    # email is fired best-effort by the caller after this returns (never fails the job).
    async with pool.acquire() as conn:
        async with conn.transaction():
            for f in flags:
                flag_id = await conn.fetchval(
                    """insert into sealed_flags
                         (workspace_id, session_id, tier, category, reviewer_summary, turn_refs)
                       values ($1, $2, $3, $4, $5, $6) returning id""",
                    session["workspace_id"], session["id"], f["tier"], f["category"],
                    f["reviewer_summary"], json.dumps(f.get("turn_refs") or []),
                )
                await conn.execute(
                    """insert into harm_incidents
                         (workspace_id, session_id, category, bucket, sealed_flag_id)
                       values ($1, $2, $3, $4, $5)""",
                    session["workspace_id"], session["id"], f["category"],
                    _bucket_for_tier(f["tier"]), flag_id,
                )


@handles("screen_disclosures")
async def _screen_disclosures_job(payload: dict) -> None:
    await screen_session(payload)
