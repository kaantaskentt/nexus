"""Ontology pipeline — the Stage 4 compiler and its satellites.
Importing this package registers every job handler with the queue."""

from . import (  # noqa: F401  (importing registers each @handles job)
    compiler,
    conflicts,
    entities,
    handoff,
    interview,
    pain,
    quality,
    workflow,
)
