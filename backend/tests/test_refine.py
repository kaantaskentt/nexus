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


async def test_refine_structurally_rejects_attribution_never_list(db, monkeypatch):
    """Non-negotiable #4: even when the agent ACCEPTS an attribution-shaped never_list
    add, the endpoint refuses it structurally (who-said-what about a person must not
    reach the interviewer via never_list). The prompt refusal is not the enforcement."""
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        return json.dumps({
            "accepted": True,
            "reply": "Added.",
            "changes": [{"target": "never_list", "op": "add",
                         "value": "don't mention that the founder said Burak is slow"}],
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/refine-chat",
                         json={"instruction": "never bring up that the founder thinks Burak is slow"})
    body = r.json()
    # Structurally rejected: never_list stays empty, rejection is audited (never silent).
    never = await db.fetchval("select never_list from interview_plans where id=$1", plan_id)
    assert (json.loads(never) if isinstance(never, str) else never) == []
    assert body["applied"] == [] and body["rejected"]
    log = await db.fetchval("select change_log from interview_plans where id=$1", plan_id)
    log = json.loads(log) if isinstance(log, str) else log
    assert log[0]["rejected"] and "attribution" in log[0]["rejected"][0]["reason"]

async def test_refine_carries_conversation_memory_across_turns(db, monkeypatch):
    """July 8 (Emre doc-2 P1): 'yes, add that version' must work. Turn 1 the agent
    refuses and OFFERS a compliant rewrite; turn 2's request context must contain the
    prior exchange — the admin instruction, the agent's reply, and above all its own
    offered alternative — so the agent can apply what it itself proposed."""
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    seen: list[str] = []

    async def turn1(agent_name, user_content, **kw):
        seen.append(user_content)
        return json.dumps({
            "accepted": False,
            "refusal_reason": "leading question",
            "alternative": "Walk me through the last repricing you did, step by step.",
            "reply": "That wording leads. I can offer an open version instead.",
            "changes": [],
        })

    monkeypatch.setattr(plans, "run_agent", turn1)
    async with _client() as c:
        r1 = await c.post(f"/api/plans/{plan_id}/refine-chat",
                          json={"instruction": "ask him to admit the repricing is too slow"})
    assert r1.status_code == 200 and not r1.json()["accepted"]
    # Turn 1 has no history block.
    assert "Conversation so far" not in seen[0]

    async def turn2(agent_name, user_content, **kw):
        seen.append(user_content)
        return json.dumps({
            "accepted": True,
            "reply": "Added the open version.",
            "changes": [{"target": "suggested_questions", "op": "add",
                         "value": "Walk me through the last repricing you did, step by step."}],
        })

    monkeypatch.setattr(plans, "run_agent", turn2)
    async with _client() as c:
        r2 = await c.post(f"/api/plans/{plan_id}/refine-chat",
                          json={"instruction": "Yes, add that version."})
    assert r2.status_code == 200 and r2.json()["accepted"]

    ctx = seen[1]
    assert "Conversation so far" in ctx
    assert "ask him to admit the repricing is too slow" in ctx           # prior instruction
    assert "That wording leads" in ctx                                   # its own reply
    assert "Walk me through the last repricing you did" in ctx           # its own offer
    # And the applied question actually landed on the plan.
    qs = await db.fetchval("select suggested_questions from interview_plans where id=$1", plan_id)
    qs = json.loads(qs) if isinstance(qs, str) else qs
    assert any("Walk me through the last repricing" in (q.get("text") or str(q)) for q in qs)
