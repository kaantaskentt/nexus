"""backfill_workflow_taxonomy plan/apply split (lane-a reserve, task #14).

The apply path writes EXACTLY the reviewed rows with ZERO LLM calls and refuses the whole
apply if the DB drifted since planning. These tests exercise apply_plan directly with
hand-built rows (no classifier), and pin that no LLM is called on the apply path.
"""

import pytest

import app.pipeline.workflow as wf
from scripts.backfill_workflow_taxonomy import PlanDriftError, apply_plan
from tests.conftest import make_workspace


async def _workflow(db, ws, name="W", *, description=None, department=None):
    return await db.fetchval(
        """insert into workflows (workspace_id, name, description, department)
           values ($1, $2, $3, $4) returning id""",
        ws, name, description, department,
    )


@pytest.fixture(autouse=True)
def _no_llm_on_apply(monkeypatch):
    """Any classifier call on the apply path is a bug — make it explode if reached."""
    async def _boom(*a, **k):
        raise AssertionError("apply must not call the LLM classifier")
    monkeypatch.setattr(wf, "classify_workflow_taxonomy", _boom)


async def test_apply_writes_exactly_the_reviewed_rows(db):
    ws = await make_workspace(db)
    a = await _workflow(db, ws, "Repricing")
    b = await _workflow(db, ws, "Content approval")
    rows = [
        {"workflow_id": str(a), "name": "Repricing",
         "description": "Reprice items daily", "department": "Operations"},
        # department unclear at plan time -> only description is written.
        {"workflow_id": str(b), "name": "Content approval",
         "description": "Approve social posts", "department": None},
    ]
    out = await apply_plan(db, rows)
    assert out == {"applied": 2}

    ra = await db.fetchrow("select description, department from workflows where id=$1", a)
    assert ra["description"] == "Reprice items daily" and ra["department"] == "Operations"
    rb = await db.fetchrow("select description, department from workflows where id=$1", b)
    assert rb["description"] == "Approve social posts" and rb["department"] is None


async def test_apply_never_overwrites_a_value_set_since_planning(db):
    ws = await make_workspace(db)
    # Department was set (by the builder) AFTER the plan was written -> drift -> refuse all.
    wid = await _workflow(db, ws, "Repricing", department="Finance")
    rows = [{"workflow_id": str(wid), "name": "Repricing",
             "description": "d", "department": "Operations"}]
    with pytest.raises(PlanDriftError):
        await apply_plan(db, rows)
    # Nothing written: the pre-existing value stands, description still null.
    row = await db.fetchrow("select description, department from workflows where id=$1", wid)
    assert row["department"] == "Finance" and row["description"] is None


async def test_apply_refuses_when_a_planned_workflow_is_gone(db):
    ws = await make_workspace(db)
    present = await _workflow(db, ws, "Repricing")
    rows = [
        {"workflow_id": str(present), "name": "Repricing",
         "description": "d", "department": "Operations"},
        {"workflow_id": "00000000-0000-0000-0000-000000000000", "name": "Ghost",
         "description": "d", "department": "Ops"},
    ]
    with pytest.raises(PlanDriftError):
        await apply_plan(db, rows)
    # The whole apply rolled back — the present workflow was NOT written either.
    row = await db.fetchrow("select description, department from workflows where id=$1", present)
    assert row["description"] is None and row["department"] is None


async def test_apply_fills_only_the_null_column_the_plan_targets(db):
    ws = await make_workspace(db)
    # description already present; plan only sets department -> description untouched, no drift.
    wid = await _workflow(db, ws, "Repricing", description="kept")
    rows = [{"workflow_id": str(wid), "name": "Repricing",
             "description": None, "department": "Operations"}]
    out = await apply_plan(db, rows)
    assert out == {"applied": 1}
    row = await db.fetchrow("select description, department from workflows where id=$1", wid)
    assert row["description"] == "kept" and row["department"] == "Operations"
