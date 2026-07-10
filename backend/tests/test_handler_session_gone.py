"""Robustness 2 (lane 5.3): post-call handlers no-op on a missing session instead of
crash-retry-failing. A session deleted before its queued job runs is a terminal no-op,
matching generate_roleplay_debrief's existing stance — not a RuntimeError."""

from app.pipeline.compiler import compile_session
from app.pipeline.disclosure import screen_session
from app.pipeline.quality import score_interview_quality
from app.pipeline.snapshot import render_snapshot
from app.pipeline.workflow import build_workflow_schema
from app.pipeline.yield_stats import compute_session_yield

_GONE = "00000000-0000-0000-0000-000000000000"


async def test_compute_yield_noops_on_missing_session(db):
    # Must not raise; returns cleanly so the job completes 'done', not 'failed'.
    await compute_session_yield({"session_id": _GONE})


async def test_screen_disclosures_noops_on_missing_session(db):
    await screen_session({"session_id": _GONE})


async def test_compile_session_noops_on_missing_session(db):
    # Converted from raise -> log+return (was crash-retry-failing on a torn-down session).
    await compile_session({"session_id": _GONE})


async def test_build_workflow_schema_noops_on_missing_session(db):
    await build_workflow_schema({"session_id": _GONE})


async def test_score_interview_quality_noops_on_missing_session(db):
    # Already returned cleanly (not converted) — pinned so a future sweep can't regress it.
    await score_interview_quality({"session_id": _GONE})


async def test_render_snapshot_noops_on_missing_workspace(db):
    # render_snapshot is workspace-scoped (no session): a deleted tenant has no claims, so
    # it returns rather than raising. Pinned as part of the same failure class.
    await render_snapshot({"workspace_id": _GONE})
