"""Question yield + final coverage — the extraction methodology measuring itself
(Emre stage-7 §10, merged A24: the Question Yield Score "is the compounding asset").

Deterministic core, no model seat: every claim record stores its evidence_quote
VERBATIM (hedges-are-data), so a record can be attributed to the respondent turn
containing its quote by normalized substring match, then credited to the nearest
preceding agent question. Records whose quote never matches a turn (compiler
elisions, cross-turn stitches) are counted unattributed, never guessed.

The final coverage audit (objective statuses back to the plan: satisfied / partial /
untouched with evidence) reuses the coverage seat ONCE, post-session — independent of
the per-turn coverage_routing flag, which stays OFF (A/B baseline). Fail-open: a
coverage error costs the audit field, never the yield stats or the compile fan-out."""

import json
import re
from datetime import datetime, timezone

from ..db import get_pool
from ..queue import handles
from . import coverage as coverage_mod

_WS = re.compile(r"\s+")


def _norm(text: str) -> str:
    return _WS.sub(" ", (text or "").casefold()).strip()


def compute_yield(utterances: list[dict], records: list[dict]) -> dict:
    """Pure attribution: records -> respondent turn containing the verbatim quote ->
    nearest preceding agent turn. `records` need `evidence_quote` (and optionally
    `mention` bool). Returns the yield_stats document minus coverage/computed_at."""
    agent_turns = [u for u in utterances if u["speaker"] == "agent"]
    normed = [(u["turn_index"], u["speaker"], _norm(u["text"])) for u in utterances]

    per_question: dict[int, dict] = {
        u["turn_index"]: {
            "turn_index": u["turn_index"],
            "question": (u["text"] or "")[:200],
            "records": 0,
            "mentions": 0,
        }
        for u in agent_turns
    }
    unattributed = 0
    for rec in records:
        quote = _norm(rec.get("evidence_quote") or "")
        home = None
        if quote:
            for idx, speaker, text in normed:
                if speaker != "agent" and quote in text:
                    home = idx
                    break
        if home is None:
            unattributed += 1
            continue
        preceding = [t for t in per_question if t < home]
        if not preceding:
            unattributed += 1
            continue
        bucket = per_question[max(preceding)]
        bucket["mentions" if rec.get("mention") else "records"] += 1

    questions = [per_question[k] for k in sorted(per_question)]
    return {
        "questions": questions,
        "total_records": len(records),
        "unattributed_records": unattributed,
        "zero_yield_questions": sum(
            1 for q in questions if q["records"] == 0 and q["mentions"] == 0
        ),
    }


async def compute_session_yield(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    session = await pool.fetchrow(
        "select id, workspace_id, plan_id from interview_sessions where id = $1", session_id
    )
    if session is None:
        raise RuntimeError(f"compute_yield: no session {session_id}")
    utterances = [
        dict(u) for u in await pool.fetch(
            "select turn_index, speaker, text from utterances "
            "where session_id = $1 order by turn_index",
            session_id,
        )
    ]
    records = [
        dict(r) for r in await pool.fetch(
            "select evidence_quote from claim_records where session_id = $1", session_id
        )
    ]
    stats = compute_yield(utterances, records)

    # Final coverage audit — objective statuses back to the plan (§10). Fail-open.
    cov = None
    if session["plan_id"] is not None:
        try:
            from .interview import _load_package, _package_objectives

            package = await _load_package(session["plan_id"])
            objectives = _package_objectives(package)
            if objectives and utterances:
                cov = await coverage_mod.compute_coverage(
                    objectives, utterances,
                    workspace_id=str(session["workspace_id"]), session_id=session_id,
                )
        except Exception:  # the audit is a bonus; yield stats must land regardless
            cov = None
    stats["coverage"] = cov
    stats["computed_at"] = datetime.now(timezone.utc).isoformat()

    await pool.execute(
        "update interview_sessions set yield_stats = $2 where id = $1",
        session_id, json.dumps(stats),
    )


@handles("compute_yield")
async def _compute_yield_job(payload: dict) -> None:
    await compute_session_yield(payload)
