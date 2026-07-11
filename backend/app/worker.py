"""Job worker entrypoint: `python -m app.worker`.
Importing app.pipeline registers every @handles job handler with the queue."""

import asyncio
import logging
import os

from . import pipeline  # noqa: F401  (registers compile_session / rate_pain)
from .db import close_pool
from .pipeline.reconcile import enqueue_sweep_once
from .queue import enqueue, worker_loop

# P1-1 (WS-8): the queue was drained by ONE loop, so a 3-minute compile blocked every job
# behind it — live-capture extraction lagged mid-interview and reports appeared minutes
# after completion (measured: compile p95 176s, snapshot p95 172s; each compile fans out
# 7 more jobs). The claim query is SKIP LOCKED — built for concurrent loops — so N loops
# in one process is the whole fix. 4 stays well inside the pool (max_size 10).
WORKER_CONCURRENCY = int(os.environ.get("WORKER_CONCURRENCY", "4"))


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    # Self-heal sweep on every boot: re-drive any context call stranded before its snapshot
    # (records saved, snapshot never composed) — idempotent, so a clean queue is a no-op.
    await enqueue("reconcile_snapshots", {})
    # Stale-session sweeper (WS-4a): auto-completes abandoned interviews so "In progress
    # forever + no report" can't happen. Self-rescheduling; guarded against stacking.
    await enqueue_sweep_once()
    logging.getLogger("nexus.worker").info("starting %d worker loops", WORKER_CONCURRENCY)
    try:
        await asyncio.gather(
            *(worker_loop(worker_id=f"worker-{i+1}") for i in range(WORKER_CONCURRENCY))
        )
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
