"""Interview deletion (Kaan P2): the preview counts exactly what the cascade removes,
the cascade takes the interview AND its Knowledge Base records (plus pain scores,
conflicts, workflow artifacts, opportunities, promises), the deliberate survivals
survive (sealed flags, agent-run audit, other sessions' records), the plan is REVOKED
with an audit transition, and a snapshot re-render is queued so no card cites deleted
evidence."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _claim(pool, ws, sess, text, **over):
    cols = dict(kind="statement", topic="pain", tag="CLAIMED", supersedes=None)
    cols.update(over)
    return await pool.fetchval(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, supersedes_id)
           values ($1,$2,$3,$4,$5,$6,$7) returning id""",
        ws, sess, cols["kind"], cols["topic"], cols["tag"], text, cols["supersedes"],
    )


async def _rich_interview(db):
    """One deletable interview with every derived artifact + a surviving neighbor."""
    ws = await make_workspace(db)
    doomed = await make_session(db, ws)
    survivor_sess = await make_session(db, ws)
    await db.execute(
        "update interview_sessions set session_kind='interview' where id in ($1,$2)",
        doomed, survivor_sess)

    plan = await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1,'COMPILED') returning id", ws)
    await db.execute("update interview_sessions set plan_id=$2 where id=$1", doomed, plan)

    await db.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'respondent','the mornings are chaos')",
        doomed)

    c1 = await _claim(db, ws, doomed, "Mornings are chaos")
    c2 = await _claim(db, ws, doomed, "It takes two hours", topic="time_or_cost")
    await db.execute(
        "insert into pain_scores (claim_id, band, rationale, rater_version) values ($1,'high','x','v1')", c1)
    # The survivor's claim supersedes a doomed one — the chain must be cut, not crash.
    keeper = await _claim(db, ws, survivor_sess, "Actually it takes three hours",
                          topic="time_or_cost", supersedes=c2)
    await db.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1,$2,$3,'worker_vs_worker','{}')""", ws, c2, keeper)

    wf = await db.fetchval(
        "insert into workflows (workspace_id, session_id, name) values ($1,$2,'Morning run') returning id",
        ws, doomed)
    await db.execute(
        """insert into workflow_steps (workflow_id, step_index, action, verified)
           values ($1, 0, 'Check the board', 'partial')""", wf)
    await db.execute(
        "insert into automation_opportunities (workspace_id, title, summary, claim_ids, workflow_id) "
        "values ($1,'Auto-board','sum',$2,$3)", ws, json.dumps([str(c1)]), wf)
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote)
           values ($1,$2,'the roster','ops','q')""", ws, doomed)
    await db.execute(
        """insert into sealed_flags (workspace_id, session_id, tier, category, reviewer_summary)
           values ($1,$2,2,'safety','reviewer-only note')""", ws, doomed)
    await db.execute(
        """insert into agent_runs (agent_name, model, prompt_version, workspace_id, session_id)
           values ('interviewer','m','v1',$1,$2)""", ws, doomed)
    await db.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,'learned','reported',1,$2)", ws, json.dumps({"title": "t", "body": "b"}))
    return ws, doomed, survivor_sess, keeper, plan


async def test_preview_counts_exactly(db):
    ws, doomed, *_ = await _rich_interview(db)
    async with _client() as c:
        p = (await c.get(f"/api/sessions/{doomed}/delete-preview")).json()
    assert p == {
        "deletable": True, "turns": 1, "records": 2, "conflicts": 1,
        "workflows": 1, "opportunities": 1, "promises": 1,
        "will_rerender_snapshot": True, "has_plan": True,
    }


async def test_cascade_and_survivals(db):
    ws, doomed, survivor_sess, keeper, plan = await _rich_interview(db)
    async with _client() as c:
        out = (await c.delete(f"/api/sessions/{doomed}")).json()
    assert out["deleted"] == {"records": 2, "conflicts": 1, "workflows": 1, "opportunities": 1}
    assert out["plan_revoked"] is True and out["snapshot_rerender_queued"] is True

    assert await db.fetchval("select count(*) from interview_sessions where id=$1", doomed) == 0
    assert await db.fetchval("select count(*) from claim_records where session_id=$1", doomed) == 0
    assert await db.fetchval("select count(*) from utterances where session_id=$1", doomed) == 0
    assert await db.fetchval("select count(*) from claim_conflicts where workspace_id=$1", ws) == 0
    assert await db.fetchval("select count(*) from workflows where workspace_id=$1", ws) == 0
    assert await db.fetchval("select count(*) from automation_opportunities where workspace_id=$1", ws) == 0
    assert await db.fetchval("select count(*) from artifact_promises where workspace_id=$1", ws) == 0

    # Survivals: the neighbor's record stands with its supersede link honestly cut.
    row = await db.fetchrow("select session_id, supersedes_id from claim_records where id=$1", keeper)
    assert row["session_id"] == survivor_sess and row["supersedes_id"] is None
    flag = await db.fetchrow("select session_id, reviewer_summary from sealed_flags where workspace_id=$1", ws)
    assert flag is not None and flag["session_id"] is None  # safety layer retained
    run = await db.fetchrow("select session_id from agent_runs where workspace_id=$1", ws)
    assert run is not None and run["session_id"] is None    # audit retained

    assert await db.fetchval("select state from interview_plans where id=$1", plan) == "REVOKED"
    t = await db.fetchrow(
        "select from_state, to_state, actor from plan_state_transitions where plan_id=$1", plan)
    assert (t["from_state"], t["to_state"], t["actor"]) == ("COMPILED", "REVOKED", "admin")

    job = await db.fetchrow(
        "select kind, payload from jobs order by id desc limit 1")
    payload = job["payload"]
    payload = json.loads(payload) if isinstance(payload, str) else payload
    assert job["kind"] == "render_snapshot" and payload["workspace_id"] == str(ws)


async def test_only_interviews_are_deletable(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='context' where id=$1", sess)
    async with _client() as c:
        r = await c.delete(f"/api/sessions/{sess}")
        p = await c.get(f"/api/sessions/{sess}/delete-preview")
        missing = await c.delete("/api/sessions/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 422 and p.status_code == 422
    assert missing.status_code == 404
    assert await db.fetchval("select count(*) from interview_sessions where id=$1", sess) == 1


async def test_delete_requires_admin(db):
    from app.auth import require_admin

    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='interview' where id=$1", sess)
    app.dependency_overrides.pop(require_admin, None)
    try:
        async with _client() as c:
            r = await c.delete(f"/api/sessions/{sess}")
        assert r.status_code == 401
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
