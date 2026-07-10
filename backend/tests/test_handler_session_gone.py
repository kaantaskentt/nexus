"""Robustness 2 (lane 5.3): post-call handlers no-op on a missing session instead of
crash-retry-failing. A session deleted before its queued job runs is a terminal no-op,
matching generate_roleplay_debrief's existing stance — not a RuntimeError."""

from app.pipeline.disclosure import screen_session
from app.pipeline.yield_stats import compute_session_yield

_GONE = "00000000-0000-0000-0000-000000000000"


async def test_compute_yield_noops_on_missing_session(db):
    # Must not raise; returns cleanly so the job completes 'done', not 'failed'.
    await compute_session_yield({"session_id": _GONE})


async def test_screen_disclosures_noops_on_missing_session(db):
    await screen_session({"session_id": _GONE})
