"""The Nexus check as a real job (premium audit P0-1): generation enqueues it, PASS
moves the plan to AWAITING_APPROVAL, RETURN sends it back to DRAFT, everything lands in
the audited change_log — and the redraft route recovers empty/returned drafts."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import plan as plan_pipeline
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _person(db, ws, name="Selin"):
    return await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, source) "
        "values ($1,'person',$2,'interview') returning id", ws, name)


async def _plan(db, ws, person, state="NEXUS_CHECK", mission=None):
    return await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state, mission) "
        "values ($1,$2,$3,$4) returning id",
        ws, person, state, json.dumps(mission or {"goal": "g", "topics": []}))


async def test_generate_enqueues_the_check(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person, state="DRAFT")

    async def _gen(*_a, **_k):
        return {"goal": "g", "topics": [], "suggested_questions": [], "never_list": []}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _gen)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})
    kind = await db.fetchval(
        "select kind from jobs where payload->>'plan_id' = $1 and kind='nexus_check'", str(plan_id))
    assert kind == "nexus_check"


async def test_check_pass_unlocks_approval(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person)

    async def _review(agent_name, *_a, **_k):
        assert agent_name == "nexus_check_reviewer"
        return {"verdict": "PASS", "flags": [{"severity": "note", "issue": "fine"}]}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _review)
    await plan_pipeline.run_nexus_check({"plan_id": str(plan_id)})
    row = await db.fetchrow("select state, change_log from interview_plans where id=$1", plan_id)
    assert row["state"] == "AWAITING_APPROVAL"
    log = row["change_log"]
    log = json.loads(log) if isinstance(log, str) else log
    assert log[-1]["actor"] == "nexus_check" and log[-1]["verdict"] == "PASS"
    t = await db.fetchrow(
        "select to_state, actor from plan_state_transitions where plan_id=$1 order by created_at desc limit 1",
        plan_id)
    assert (t["to_state"], t["actor"]) == ("AWAITING_APPROVAL", "nexus_check")


async def test_check_fail_flag_returns_to_draft(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person)

    async def _review(*_a, **_k):
        # A lying PASS verdict with a fail flag must still RETURN (fail dominates).
        return {"verdict": "PASS",
                "flags": [{"severity": "fail", "kind": "credential", "issue": "asks for a login"}]}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _review)
    await plan_pipeline.run_nexus_check({"plan_id": str(plan_id)})
    assert await db.fetchval("select state from interview_plans where id=$1", plan_id) == "DRAFT"


async def test_check_is_idempotent_after_move(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person, state="AWAITING_APPROVAL")

    async def _boom(*_a, **_k):
        raise AssertionError("reviewer must not run on a moved plan")

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _boom)
    await plan_pipeline.run_nexus_check({"plan_id": str(plan_id)})  # no-op, no raise


async def test_redraft_reenqueues_generation_with_custom_focus(db):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person, state="DRAFT",
                          mission={"goal": "", "topics": [], "custom_focus": "lead gen"})
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/redraft")
    assert r.status_code == 200
    job = await db.fetchrow(
        "select payload from jobs where kind='generate_plan' and payload->>'plan_id'=$1",
        str(plan_id))
    assert job["payload"]["custom_goal"] == "lead gen"


async def test_redraft_illegal_after_send(db):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await _plan(db, ws, person, state="SENT")
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/redraft")
    assert r.status_code == 409
