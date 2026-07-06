"""Send Interview (A4) — mint a token-keyed session from an APPROVED plan, build the
handoff, move the plan to SENT."""

import json

import pytest
from fastapi import HTTPException

from app.routers.plans import SendIn, send_interview
from tests.conftest import make_workspace


async def _approved_plan(db, ws, interviewee):
    mission = {"goal": "returns", "topics": [{"label": "steps", "must_hit": True}],
               "interview_topic": "how returns work"}
    return await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state, mission, never_list) "
        "values ($1,$2,'APPROVED',$3,'[]'::jsonb) returning id", ws, interviewee, json.dumps(mission))


async def test_send_mints_session_and_moves_to_sent(db):
    ws = await make_workspace(db, industry="jewelry")
    burak = await db.fetchval(
        "insert into entities (workspace_id,entity_type,canonical_name,role) "
        "values ($1,'person','Burak','Operations') returning id", ws)
    plan_id = await _approved_plan(db, ws, burak)

    result = await send_interview(str(plan_id), SendIn(interviewee_name="Burak"))

    assert result["token"] and result["state"] == "SENT"
    assert result["invite_path"] == f"/i/{result['token']}"
    # session exists, token-keyed, bound to the plan + interviewee
    sess = await db.fetchrow("select * from interview_sessions where invite_token = $1", result["token"])
    assert sess is not None and str(sess["plan_id"]) == str(plan_id)
    assert sess["interviewee_id"] == burak and sess["token_expires_at"] is not None
    # handoff built, plan moved
    assert await db.fetchval("select 1 from handoff_packages where plan_id = $1", plan_id)
    assert await db.fetchval("select state from interview_plans where id = $1", plan_id) == "SENT"


async def test_send_refuses_unapproved_plan(db):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1,'DRAFT') returning id", ws)
    with pytest.raises(HTTPException) as e:
        await send_interview(str(plan_id), SendIn())
    assert e.value.status_code == 409
