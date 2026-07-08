"""Simulations proving history (task #28). The endpoint serves the versioned record from
app/simulation_history.py; these tests pin its shape and the client-safety invariants:
numbers are internally consistent, partial rounds say so, and no internal eval vocabulary
(heuristic ids, harness/infra terms) ever reaches a client-facing string."""

import re

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.simulation_history import SIMULATION_CAST, SIMULATION_ROUNDS


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_history_shape_and_consistency(db):
    async with _client() as c:
        r = await c.get("/api/simulations/history")
    assert r.status_code == 200
    body = r.json()
    assert len(body["cast"]) == 5  # the five-persona matrix cast
    for member in body["cast"]:
        assert member["role"] and member["style"] and member["tests"]
    assert len(body["rounds"]) >= 2
    for rd in body["rounds"]:
        # Scores can never exceed their denominators, and every round explains itself.
        assert 0 <= rd["surfaced"] <= rd["surfaced_total"]
        assert 0 <= rd["traps_taken"] <= rd["traps_total"]
        assert rd["note"]
        assert isinstance(rd["complete"], bool)


def test_no_internal_vocabulary_leaks():
    """The proof-matrix doc speaks in h-bk-3 / arm A / EVAL_MODE. None of that may reach
    the client surface — plain language only (task #28 requirement)."""
    banned = re.compile(
        r"h-[a-z]{2}-\d|\barm [AB]\b|EVAL_MODE|COVERAGE_ROUTING|\bheuristic|\bharness|\bpersona",
        re.IGNORECASE,
    )
    for member in SIMULATION_CAST:
        for value in (member["role"], member["style"], member["tests"]):
            assert not banned.search(value), value
    for rd in SIMULATION_ROUNDS:
        for value in (rd["label"], rd["note"]):
            assert not banned.search(value), value


def test_partial_rounds_marked():
    """Round 3 was interrupted mid-run — it must carry complete=False, never present a
    partial score as a full matrix result."""
    r3 = next(r for r in SIMULATION_ROUNDS if r["round"] == 3)
    assert r3["complete"] is False
    assert r3["surfaced_total"] < 16  # only the characters that actually ran
