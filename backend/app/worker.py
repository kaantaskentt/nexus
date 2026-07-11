"""Job worker entrypoint: `python -m app.worker`.
Importing app.pipeline registers every @handles job handler with the queue."""

import asyncio
import logging

from . import pipeline  # noqa: F401  (registers compile_session / rate_pain)
from .db import close_pool
from .pipeline.reconcile import enqueue_sweep_once
from .queue import enqueue, worker_loop


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    # Self-heal sweep on every boot: re-drive any context call stranded before its snapshot
    # (records saved, snapshot never composed) — idempotent, so a clean queue is a no-op.
    await enqueue("reconcile_snapshots", {})
    # Stale-session sweeper (WS-4a): auto-completes abandoned interviews so "In progress
    # forever + no report" can't happen. Self-rescheduling; guarded against stacking.
    await enqueue_sweep_once()
    try:
        await worker_loop()
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
