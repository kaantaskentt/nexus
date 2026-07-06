"""Plan refine-chat (V2 #20). The agent is mocked; these assert that accepted edits
apply as bounded machine rules with an audited change_log entry, and refusals mutate
nothing yet are still recorded (never silent)."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers import plans
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _plan(db, ws):
    return await db.fetchval(
        "insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list) "
        "values ($1, 'DRAFT', $2, '[]', '[]') returning id",
        ws, json.dumps({"goal": "understand repricing", "handling_notes": []}),
    )


async def test_refine_applies_bounded_change_and_audits(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        assert agent_name == "plan_refine_chat"
        return json.dumps({
            "accepted": True,
            "reply": "Added a rule to avoid the Harrods topic.",
            "changes": [{"target": "never_list", "op": "add",
                         "value": "Do not mention the Harrods renegotiation"}],
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/refine-chat",
                         json={"instruction": "never bring up the Harrods deal"})
    body = r.json()
    assert r.status_code == 200 and body["accepted"]
    never = await db.fetchval("select never_list from interview_plans where id=$1", plan_id)
    never = json.loads(never) if isinstance(never, str) else never
    assert "Do not mention the Harrods renegotiation" in never
    log = await db.fetchval("select change_log from interview_plans where id=$1", plan_id)
    log = json.loads(log) if isinstance(log, str) else log
    assert len(log) == 1 and log[0]["accepted"] and log[0]["applied"]


async def test_refine_refusal_mutates_nothing_but_logs(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        return json.dumps({
            "accepted": False,
            "refusal_reason": "That injects a person-judgment into the plan.",
            "alternative": "Walk me through who touches repricing and where it slows.",
            "reply": "I can't add that, but here's a neutral version.",
            "changes": [],
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/refine-chat",
                         json={"instruction": "add a question asking if Burak is the bottleneck"})
    body = r.json()
    assert r.status_code == 200 and body["accepted"] is False
    assert body["alternative"]
    never = await db.fetchval("select never_list from interview_plans where id=$1", plan_id)
    assert (json.loads(never) if isinstance(never, str) else never) == []
    log = await db.fetchval("select change_log from interview_plans where id=$1", plan_id)
    log = json.loads(log) if isinstance(log, str) else log
    assert len(log) == 1 and log[0]["accepted"] is False and log[0]["applied"] == []
