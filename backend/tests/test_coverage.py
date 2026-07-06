"""Coverage-routing regression (task #12 / morning-packet §5). The model-backed
`compute_coverage` is exercised end-to-end by the agent-vs-agent http matrix
(evals/e2e/proof-matrix.md); here we pin the DETERMINISTIC core offline — objective
normalization and the close-gate directive — so the routing logic can't silently
regress without a live model or DB.

The one failure this whole seat exists to stop: an interview closing with an untouched
must-hit (bookkeeper h-bk-3, agency ag-2). The gate below is what prevents it."""

from app.pipeline.coverage import build_coverage_block, normalize_objectives


def test_normalize_bare_strings_are_all_must_hit():
    # A bare objective list (real handoff.py topics) means every objective matters.
    objs = normalize_objectives(["The month-end close", "Where data is re-keyed"])
    assert all(o["must_hit"] for o in objs)
    assert [o["label"] for o in objs] == ["The month-end close", "Where data is re-keyed"]


def test_normalize_respects_explicit_must_hit_flags():
    # The eval handoff shape: explicit flags — unspecified defaults to False once any is declared.
    objs = normalize_objectives([
        {"label": "A", "must_hit": True},
        {"label": "B", "must_hit": False},
        {"label": "C"},
    ])
    assert {o["label"]: o["must_hit"] for o in objs} == {"A": True, "B": False, "C": False}


def test_gate_fires_and_routes_to_untouched_must_hit():
    coverage = [
        {"label": "Workflow", "must_hit": True, "status": "satisfied", "evidence": "x"},
        {"label": "Export reshape", "must_hit": True, "status": "partial", "evidence": "y"},
        {"label": "Deadline tracking", "must_hit": True, "status": "untouched", "evidence": "none"},
    ]
    block = build_coverage_block(coverage)
    # Hard-gate the close, and route to the UNTOUCHED must-hit before the merely-partial one.
    assert "unsatisfied MUST-HIT" in block
    assert "Deadline tracking" in block
    assert "Do not move toward closing" in block
    # Non-negotiables stay above the gate: NEVER list and time-pressure still win.
    assert "NEVER list" in block and "time-pressure" in block


def test_partial_must_hit_still_gates_when_none_untouched():
    coverage = [
        {"label": "A", "must_hit": True, "status": "satisfied", "evidence": "x"},
        {"label": "B", "must_hit": True, "status": "partial", "evidence": "y"},
    ]
    block = build_coverage_block(coverage)
    assert "unsatisfied MUST-HIT" in block and '"B"' in block


def test_all_must_hits_satisfied_clears_the_close():
    coverage = [
        {"label": "A", "must_hit": True, "status": "satisfied", "evidence": "x"},
        {"label": "B", "must_hit": False, "status": "untouched", "evidence": "none"},
    ]
    block = build_coverage_block(coverage)
    # A non-must-hit left untouched must NOT hold the interview open.
    assert "All must-hit objectives are satisfied" in block
    assert "Do not move toward closing" not in block


def test_none_or_empty_coverage_injects_nothing():
    # Fail-open: no computed map -> no directive -> engine falls back to model-side coverage.
    assert build_coverage_block(None) == ""
    assert build_coverage_block([]) == ""
