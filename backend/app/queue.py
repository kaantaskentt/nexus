"""Job queue — SKIP LOCKED worker pattern, vendored from Tunç's nexus_backend-main
(see reference/SOURCES.md). Interview turns enqueue at priority 10; batch work at 100."""

import asyncio
import json
import traceback
from typing import Awaitable, Callable

from .db import get_pool

Handler = Callable[[dict], Awaitable[None]]
_handlers: dict[str, Handler] = {}


def handles(kind: str):
    """Register an async job handler: @handles('compile_session')."""

    def deco(fn: Handler) -> Handler:
        _handlers[kind] = fn
        return fn

    return deco


async def enqueue(kind: str, payload: dict, priority: int = 100) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        "insert into jobs (kind, payload, priority) values ($1, $2, $3) returning id",
        kind,
        json.dumps(payload),
        priority,
    )
    return row["id"]


async def _claim_one(worker_id: str):
    pool = await get_pool()
    return await pool.fetchrow(
        """
        update jobs set status = 'running', locked_by = $1, locked_at = now(),
                        attempts = attempts + 1
        where id = (
            select id from jobs
            where status = 'queued' and run_after <= now()
            order by priority, id
            for update skip locked
            limit 1
        )
        returning id, kind, payload, attempts, max_attempts
        """,
        worker_id,
    )


async def worker_loop(worker_id: str = "worker-1", poll_seconds: float = 1.0) -> None:
    pool = await get_pool()
    while True:
        job = await _claim_one(worker_id)
        if job is None:
            await asyncio.sleep(poll_seconds)
            continue
        handler = _handlers.get(job["kind"])
        try:
            if handler is None:
                raise RuntimeError(f"no handler registered for job kind {job['kind']!r}")
            await handler(job["payload"])
            await pool.execute("update jobs set status = 'done' where id = $1", job["id"])
        except Exception:
            err = traceback.format_exc()
            failed = job["attempts"] >= job["max_attempts"]
            await pool.execute(
                """update jobs set status = $2, last_error = $3,
                          run_after = now() + interval '30 seconds'
                   where id = $1""",
                job["id"],
                "failed" if failed else "queued",
                err[-4000:],
            )
