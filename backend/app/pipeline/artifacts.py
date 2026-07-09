"""Artifact promises (Kaan feature 1, July 8).

One pass over a completed session's verbatim transcript extracting every genuine
commitment the respondent made to share a real artifact ("I'll send the ICP doc").
Each becomes an artifact_promises row: item + the objective context it arose under +
the verbatim offer as provenance. The done page then offers the upload, the admin
tracks promised-vs-delivered, and a delivered file stays linked to that context.

Runs beside compile_session (enqueued at completion, same seam as the disclosure
screen) so a failed compile never loses a promise. Idempotent per session: re-runs
replace only still-undelivered rows, never a delivered artifact."""

import logging

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles
from .compiler import _transcript_block

log = logging.getLogger("nexus.artifacts")


async def scan_artifact_promises(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    row = await pool.fetchrow(
        "select workspace_id, session_kind from interview_sessions where id = $1", session_id
    )
    if row is None:
        log.warning("artifact scan: session %s not found", session_id)
        return
    # Only real interviews carry promises a client should see (0007 firewall posture).
    if row["session_kind"] not in ("interview",):
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

    data = await run_agent_json(
        "artifact_promise_scan",
        "# Transcript (verbatim)\n" + _transcript_block(utterances),
        workspace_id=str(row["workspace_id"]),
    )

    promises = []
    for p in data.get("promises") or []:
        item = (p.get("item") or "").strip()
        if not item:
            continue
        promises.append({
            "item": item[:300],
            "objective_context": (p.get("objective_context") or "").strip()[:500] or None,
            "quote": (p.get("quote") or "").strip()[:1000] or None,
        })

    async with pool.acquire() as conn, conn.transaction():
        # Replace undelivered rows only — a delivered artifact is a kept promise and
        # is never regenerated away.
        await conn.execute(
            "delete from artifact_promises where session_id = $1 and status = 'promised'",
            session_id,
        )
        for p in promises:
            await conn.execute(
                """insert into artifact_promises
                     (workspace_id, session_id, item, objective_context, quote)
                   values ($1, $2, $3, $4, $5)""",
                row["workspace_id"], session_id, p["item"], p["objective_context"], p["quote"],
            )
    log.info("artifact scan: %d promise(s) for session %s", len(promises), session_id)


@handles("scan_artifact_promises")
async def _scan_artifact_promises_job(payload: dict) -> None:
    await scan_artifact_promises(payload)
