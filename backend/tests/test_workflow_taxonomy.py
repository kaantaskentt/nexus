"""Lane C (SIMPLIFY §4-C) — workflow department/description taxonomy + derived confidence.
LLM is mocked; asserts the confident-only classification rule, persistence, and that
list_workflows surfaces the new fields with a truthful updated_at and a derived confidence
rollup. The derivation is NOT a claim trust tag — it maps step verified-ratio through the
ladder vocabulary (High/Medium/Low)."""

import json

from app.pipeline import workflow
from app.pipeline.workflow import _clean_department, _clean_description
from app.routers.workflows import _derive_confidence, list_workflows
from tests.conftest import make_session, make_workspace


def _agent_mock(by_agent: dict):
    async def _run(agent_name, content, **kw):
        return by_agent.get(agent_name, "[]")
    return _run


def test_derive_confidence_tiers():
    assert _derive_confidence(0, 0) is None          # empty workflow claims no confidence
    assert _derive_confidence(10, 7) == "high"       # 0.70 boundary
    assert _derive_confidence(10, 6) == "medium"     # 0.60
    assert _derive_confidence(10, 4) == "medium"     # 0.40
    assert _derive_confidence(10, 3) == "low"        # 0.30
    assert _derive_confidence(3, 3) == "high"


def test_clean_department_normalizes_and_nulls():
    assert _clean_department("Operations") == "Operations"
    assert _clean_department("  operations ") == "Operations"   # case/space-insensitive
    assert _clean_department("Sales") == "Sales"
    assert _clean_department("unclear") is None                 # off-list → unclassified
    assert _clean_department("") is None
    assert _clean_department(None) is None
    assert _clean_department(123) is None


def test_clean_description_trims_and_nulls():
    assert _clean_description("  Reprice gold each morning. ") == "Reprice gold each morning."
    assert _clean_description("") is None
    assert _clean_description(None) is None


async def test_build_workflow_schema_persists_taxonomy(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    c1 = await db.fetchval(
        "insert into claim_records (workspace_id,session_id,kind,topic,tag,claim_text) "
        "values ($1,$2,'statement','process_step','CLAIMED','Reprice at open') returning id", ws, sess)
    schema = json.dumps({
        "name": "Daily Gold Repricing",
        "description": "Reprice gold across boutiques each morning from the spot price.",
        "department": "operations",   # lower-case → normalises to Operations
        "steps": [{"action": "Reprice at open", "tool": "Excel", "input": None, "output": "prices",
                   "verified": "verified", "spine_slots": {}, "slot_scores": {}, "claim_ids": [str(c1)]}],
    })
    monkeypatch.setattr("app.llm.run_agent", _agent_mock({"report_sop_generator": schema}))
    await workflow.build_workflow_schema({"session_id": str(sess)})

    wf = await db.fetchrow("select * from workflows where session_id=$1", sess)
    assert wf["department"] == "Operations"
    assert wf["description"].startswith("Reprice gold across boutiques")


async def test_build_workflow_schema_offlist_department_is_null(db, monkeypatch):
    """An off-vocabulary department is dropped to null — unclassified, never guessed."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    schema = json.dumps({
        "name": "Mystery Flow", "description": "Something ambiguous.", "department": "Wizardry",
        "steps": [{"action": "do a thing", "verified": "partial", "spine_slots": {}, "slot_scores": {},
                   "claim_ids": []}],
    })
    monkeypatch.setattr("app.llm.run_agent", _agent_mock({"report_sop_generator": schema}))
    # a process_step claim so the builder has records to work from
    await db.execute(
        "insert into claim_records (workspace_id,session_id,kind,topic,tag,claim_text) "
        "values ($1,$2,'statement','process_step','CLAIMED','do a thing')", ws, sess)
    await workflow.build_workflow_schema({"session_id": str(sess)})

    wf = await db.fetchrow("select * from workflows where session_id=$1", sess)
    assert wf["department"] is None
    assert wf["description"] == "Something ambiguous."


async def test_list_workflows_surfaces_taxonomy_confidence_and_updated_at(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    wid = await db.fetchval(
        """insert into workflows (workspace_id, session_id, name, description, department, created_at)
           values ($1,$2,'Repricing','Reprice gold daily','Operations', now() - interval '2 days')
           returning id""", ws, sess)
    # 3 steps, 2 verified -> ratio 0.67 -> medium
    for i, v in enumerate(["verified", "verified", "partial"]):
        await db.execute(
            "insert into workflow_steps (workflow_id, step_index, action, verified) values ($1,$2,$3,$4)",
            wid, i, f"step {i}", v)
    # an edit overlay lands later than the workflow's created_at -> updated_at must reflect it
    await db.execute(
        "insert into workflow_step_overlays (workflow_id, step_id, op, payload) "
        "select $1, id, 'annotate', '{}'::jsonb from workflow_steps where workflow_id=$1 limit 1", wid)

    rows = await list_workflows(str(ws))
    assert len(rows) == 1
    r = rows[0]
    assert r["department"] == "Operations"
    assert r["description"] == "Reprice gold daily"
    assert r["step_count"] == 3
    assert r["confidence"] == "medium"
    assert r["updated_at"] > r["created_at"]   # the overlay moved it forward
