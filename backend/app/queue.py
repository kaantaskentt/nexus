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


async def enqueue(kind: str, payload: dict, priority: int = 100, delay_seconds: int = 0) -> int:
    """delay_seconds > 0 sets run_after into the future — used by self-rescheduling
    backstop jobs (the stale-session sweeper); 0 keeps today's run-now behavior."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "insert into jobs (kind, payload, priority, run_after) "
        "values ($1, $2, $3, now() + ($4 || ' seconds')::interval) returning id",
        kind,
        json.dumps(payload),
        priority,
        str(int(delay_seconds)),
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


ZOMBIE_RUNNING_MINUTES = 30


async def requeue_zombie_jobs(older_than_minutes: int = ZOMBIE_RUNNING_MINUTES) -> int:
    """Lease recovery (July 10 night finding): a worker killed mid-job (deploy restart,
    crash) leaves its claim stuck at 'running' forever — nothing ever re-drove it. Requeue
    any 'running' job whose lock is older than the threshold; 30 min sits far above the
    slowest real job (compile p95 ~3 min). Attempts already counted on claim, so a job
    that keeps dying still exhausts max_attempts instead of looping forever. Idempotent;
    called at worker boot and from the periodic sweep."""
    pool = await get_pool()
    rows = await pool.fetch(
        """update jobs set status = 'queued', locked_by = null
            where status = 'running'
              and locked_at < now() - ($1 || ' minutes')::interval
            returning id, kind""",
        str(int(older_than_minutes)),
    )
    for r in rows:
        import logging
        logging.getLogger("nexus.queue").warning(
            "requeued zombie job %s (%s) — worker died holding the claim", r["id"], r["kind"])
    return len(rows)


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
        except Exception as e:
            await record_job_failure(pool, job, e)


async def record_job_failure(pool, job, exc: Exception) -> None:
    """WS-5: a provider failure gets a NAMED prefix on last_error (health/deep and the
    admin banner read it) and a backoff matched to how it actually heals — an empty tank
    doesn't refill in 30s, so credit/auth errors wait 5 minutes between retries instead
    of thrashing the queue. Retries stay: the July 10 top-up proved queued work
    completing afterward is the right behavior. Anything unrecognized keeps the classic
    30s retry with the traceback tail."""
    from .llm import classify_provider_error

    named = classify_provider_error(exc)
    err = traceback.format_exc()
    if named:
        err = f"{named}\n{err}"
    backoff = {"credits_exhausted": 300, "auth": 300, "rate_limited": 60}.get(
        named.kind, 30) if named else 30
    failed = job["attempts"] >= job["max_attempts"]
    await pool.execute(
        """update jobs set status = $2, last_error = $3,
                  run_after = now() + ($4 || ' seconds')::interval
           where id = $1""",
        job["id"],
        "failed" if failed else "queued",
        err[:4000] if named else err[-4000:],
        str(backoff),
    )
