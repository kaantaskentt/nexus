"""Consent landing context on GET /by-token — the topic must be the NEUTRAL plan
area, never derived from claim text (non-negotiable #2)."""

import json

import os

from app.routers.sessions import get_by_token


async def test_consent_context_from_plan_not_records(db):
    ws = await db.fetchval(
        "insert into workspaces (name, slug, industry, is_demo, config) "
        "values ('Bee Goddess', $1, 'jewelry', true, $2) returning id",
        f"cw-{os.urandom(3).hex()}", json.dumps({"admin_name": "Kaan"}),
    )
    burak = await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, role, source) "
        "values ($1, 'person', 'Burak Yilmaz', 'Operations', 'fixture') returning id", ws)
    mission = {"interview_topic": "how the morning repricing works", "time_budget_minutes": 25}
    plan = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state, mission) "
        "values ($1, $2, 'APPROVED', $3) returning id", ws, burak, json.dumps(mission))
    await db.execute(
        "insert into interview_sessions (workspace_id, plan_id, interviewee_id, modality, invite_token, status) "
        "values ($1, $2, $3, 'text', 'consent-tok', 'pending')", ws, plan, burak)

    result = await get_by_token("consent-tok")
    ctx = result["context"]
    assert ctx["respondent_first_name"] == "Burak"     # first name only (F4)
    assert ctx["company_name"] == "Bee Goddess"
    assert ctx["admin_name"] == "Kaan"
    assert ctx["topic"] == "how the morning repricing works"  # neutral, plan-sourced
    assert ctx["est_minutes"] == 25
    assert ctx["modality"] == "text"
