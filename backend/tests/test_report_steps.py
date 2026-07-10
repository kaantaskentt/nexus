"""Company Report workflow-step export (pilot §3, leak 3). Deterministic, no DB, no model.

Empty "New manual step (still to confirm)" placeholder cards leaked into the client export,
and dropping hidden steps left gaps in the numbering (it jumped 9 → 12 → 13). These tests pin
the compose-time projection: placeholders out, survivors renumbered 1..n with no gaps.
"""

from app.routers.company_report import _export_steps, _is_empty_manual


def _claim_step(index, title):
    return {"step_id": f"c{index}", "source": "claim_derived", "index": index, "hidden": False,
            "title": title, "action": title, "tool": None, "input": None, "output": None,
            "status": "confirmed", "claim_ids": [f"claim-{index}"]}


def _manual_placeholder(index):
    return {"step_id": f"m{index}", "source": "manual", "index": index, "hidden": False,
            "title": "New manual step", "action": None, "tool": None, "input": None,
            "output": None, "status": "needs_clarification", "claim_ids": []}


def test_empty_manual_placeholder_is_detected():
    assert _is_empty_manual(_manual_placeholder(3)) is True
    # A manual step a reviewer actually wrote is kept.
    filled = {**_manual_placeholder(3), "action": "Submit the weekly stock count"}
    assert _is_empty_manual(filled) is False
    titled = {**_manual_placeholder(3), "title": "Reconcile returns"}
    assert _is_empty_manual(titled) is False


def test_claim_derived_step_is_never_treated_as_placeholder():
    # Only manual placeholders drop; a real (claim-derived) step never does.
    assert _is_empty_manual({**_claim_step(0, ""), "action": None}) is False


def test_hidden_and_placeholder_removed_and_renumbered_contiguously():
    steps = [
        _claim_step(0, "Intake"),
        _claim_step(1, "Due diligence"),
        {**_claim_step(2, "Hidden one"), "hidden": True},
        _manual_placeholder(3),
        _claim_step(4, "Deliver deck"),
    ]
    out = _export_steps(steps)
    # Two dropped (one hidden, one empty placeholder); three survive.
    assert [s["title"] for s in out] == ["Intake", "Due diligence", "Deliver deck"]
    # Numbering is contiguous — the 9 → 12 gap can no longer happen.
    assert [s["index"] for s in out] == [0, 1, 2]
    # claim_ids preserved for the downstream trust-tag (leak 2) calculation.
    assert out[-1]["claim_ids"] == ["claim-4"]
