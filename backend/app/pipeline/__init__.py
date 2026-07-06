"""Ontology pipeline — the Stage 4 compiler and its satellites.
Importing this package registers every job handler with the queue."""

from . import compiler, entities, handoff, interview, pain  # noqa: F401  (registers @handles)
