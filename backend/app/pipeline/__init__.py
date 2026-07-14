"""Ontology pipeline — the Stage 4 compiler and its satellites.
Importing this package registers every job handler with the queue."""

from . import (  # noqa: F401  (importing registers each @handles job)
    artifacts,
    automation,
    compiler,
    conflicts,
    deep_research,
    disclosure,
    entities,
    handoff,
    heuristics,
    interview,
    live_capture,
    media_share,
    pain,
    plan,
    quality,
    recon,
    reconcile,
    roleplay,
    snapshot,
    workflow,
    workflow_edit,
    yield_stats,
)
