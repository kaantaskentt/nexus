"""Job worker entrypoint: `python -m app.worker`.
Importing app.pipeline registers every @handles job handler with the queue."""

import asyncio
import logging

from . import pipeline  # noqa: F401  (registers compile_session / rate_pain)
from .db import close_pool
from .queue import worker_loop


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    try:
        await worker_loop()
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
