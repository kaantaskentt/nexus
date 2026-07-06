"""Plan generation wiring (#30): POST /api/plans/generate mints a DRAFT plan and enqueues
the standard generate_plan job; the job persists the plan and advances it to NEXUS_CHECK
(A4). Non-negotiable #4: quarantined sentiment can never reach the plan generator."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import plan as plan_pipeline
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _person(db, ws, name="Selin", role="Returns"):
    return await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, role, source) "
        "values ($1,'person',$2,$3,'interview') returning id",
        ws, name, role,
    )


async def test_generate_endpoint_creates_draft_and_enqueues(db):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    async with _client() as c:
        r = await c.post("/api/plans/generate", json={"workspace_id": str(ws), "entity_id": str(person)})
    assert r.status_code == 200
    out = r.json()
    assert out["state"] == "DRAFT"

    row = await db.fetchrow("select state, interviewee_id from interview_plans where id = $1", out["plan_id"])
    assert row["state"] == "DRAFT"
    assert str(row["interviewee_id"]) == str(person)

    job = await db.fetchrow("select kind, payload from jobs where id = $1", out["job_id"])
    assert job["kind"] == "generate_plan"
    assert json.loads(job["payload"])["plan_id"] == out["plan_id"]


async def test_generate_endpoint_resolves_person_by_name(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.post(
            "/api/plans/generate",
            json={"workspace_id": str(ws), "person_name": "Deniz", "person_role": "Ops"},
        )
    assert r.status_code == 200
    # The person was minted as a client-side entity.
    ent = await db.fetchrow("select canonical_name, role from entities where workspace_id=$1", ws)
    assert ent["canonical_name"] == "Deniz"


async def test_generate_endpoint_requires_person(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.post("/api/plans/generate", json={"workspace_id": str(ws)})
    assert r.status_code == 422


async def test_generate_plan_job_persists_and_advances(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id",
        ws, person,
    )

    generated = {
        "goal": "Understand how online returns are handled day to day",
        "interview_topic": "the returns process",
        "known_context": ["Returns run through one person"],
        "topics": [{"label": "The returns workflow end to end", "must_hit": True,
                    "detail": "one recent episode, steps, tools, exceptions"}],
        "definition_of_done": ["one returns episode walked through in order"],
        "handling_notes": ["keep it concrete"],
        "never_list": ["Do not name or characterize any colleague"],
        "vocabulary": ["yildirim"],
        "suggested_questions": [{"text": "Walk me through the last return you processed.",
                                 "topic": "process_step", "audience": "does_the_work"}],
        "time_budget_minutes": 30,
    }

    async def _fake(agent_name, user_content, **kw):
        assert agent_name == "plan_generator"
        return generated

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _fake)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})

    row = await db.fetchrow(
        "select state, mission, suggested_questions, never_list from interview_plans where id=$1",
        plan_id,
    )
    assert row["state"] == "NEXUS_CHECK"
    mission = json.loads(row["mission"])
    assert mission["goal"].startswith("Understand how online returns")
    assert mission["topics"][0]["must_hit"] is True
    assert json.loads(row["never_list"]) == ["Do not name or characterize any colleague"]
    assert json.loads(row["suggested_questions"])[0]["topic"] == "process_step"

    # The lifecycle move is recorded.
    t = await db.fetchrow(
        "select from_state, to_state, actor from plan_state_transitions where plan_id=$1", plan_id)
    assert (t["from_state"], t["to_state"], t["actor"]) == ("DRAFT", "NEXUS_CHECK", "system")


async def test_generate_plan_excludes_quarantined_records(db, monkeypatch):
    """The generator must never see a quarantined record (sentiment about a named person)."""
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) values ($1,$2,'DRAFT') returning id",
        ws, person,
    )
    # A safe process record (visible) and a quarantined sentiment record (must be excluded).
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1,'statement','process_step','CLAIMED','Returns are handled every morning', false)", ws)
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text, sentiment_flag, quarantined) "
        "values ($1,'statement','person',null,'The founder thinks Selin is careless', true, true)", ws)

    seen = {}

    async def _capture(agent_name, user_content, **kw):
        seen["content"] = user_content
        return {"goal": "x", "topics": [], "suggested_questions": [], "never_list": []}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _capture)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})

    assert "handled every morning" in seen["content"]          # visible record reached it
    assert "careless" not in seen["content"]                    # quarantined never did
