"""SIMPLIFY I — GET /{workspace_id}/scenarios derives simulation scenarios from a
workspace's real workflows. Display-only endpoint (my half of the #10 split); the Run
mint takes only workflow_id. Asserts qualification (>=3 steps), ranking by testing value,
honest signals, and the empty case."""

import json

from app.routers.simulations import list_scenarios
from tests.conftest import make_session, make_workspace


async def _workflow(db, ws, name, steps):
    """steps: list of (verified, spine_slots dict)."""
    sess = await make_session(db, ws)
    wid = await db.fetchval(
        "insert into workflows (workspace_id, session_id, name) values ($1,$2,$3) returning id",
        ws, sess, name)
    for i, (verified, spine) in enumerate(steps):
        await db.execute(
            "insert into workflow_steps (workflow_id, step_index, action, verified, spine_slots) "
            "values ($1,$2,$3,$4,$5)",
            wid, i, f"step {i}", verified, json.dumps(spine))
    return str(wid)


async def test_qualifies_at_three_steps(db):
    ws = await make_workspace(db, industry="jewelry")
    await _workflow(db, ws, "TwoStep", [("verified", {}), ("verified", {})])          # too small
    big = await _workflow(db, ws, "ThreeStep", [("partial", {}), ("partial", {}), ("partial", {})])
    out = await list_scenarios(str(ws))
    ids = [s["workflow_id"] for s in out]
    assert big in ids
    assert len(out) == 1  # the 2-step workflow is not a scenario


async def test_signals_and_summary_from_spine(db):
    ws = await make_workspace(db, industry="jewelry")
    await _workflow(db, ws, "Repricing", [
        ("verified", {"exceptions": "site down"}),
        ("verified", {"rules": "if spot diverges, wait"}),
        ("verified", {}),
    ])
    out = await list_scenarios(str(ws))
    s = out[0]
    assert s["signals"]["has_exceptions"] is True
    assert s["signals"]["has_decisions"] is True
    assert s["signals"]["confidence"] == "high"          # 3/3 verified
    assert "exceptions" in s["tests_summary"]
    assert "decision logic" in s["tests_summary"]
    assert s["label"] == "Repricing"


async def test_ranked_by_testing_value(db):
    ws = await make_workspace(db, industry="jewelry")
    # plain: 3 verified steps, no exceptions/decisions, high confidence -> lowest score
    plain = await _workflow(db, ws, "Plain", [("verified", {})] * 3)
    # risky: exceptions + decisions + low confidence -> highest score
    risky = await _workflow(db, ws, "Risky", [
        ("unverified", {"exceptions": "x"}),
        ("unverified", {"rules": "y"}),
        ("unverified", {}),
    ])
    out = await list_scenarios(str(ws))
    assert out[0]["workflow_id"] == risky   # risky ranks first
    assert out[-1]["workflow_id"] == plain


async def test_empty_when_no_qualifying_workflow(db):
    ws = await make_workspace(db, industry="jewelry")
    await _workflow(db, ws, "Tiny", [("verified", {})])   # 1 step
    assert await list_scenarios(str(ws)) == []
