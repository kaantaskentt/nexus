"""SIMPLIFY lane A — DESTRUCTIVE company delete (§6-1), built inert behind a hard gate.

The endpoint returns 403 until settings.workspace_delete_enabled is flipped on (waits on
Kaan's confirm). With it on, the cascade removes the whole tenant in one transaction and
the deliberate survivals survive: agent_runs kept with refs nulled, sealed_flags DELETED
(departure flagged to Emre), and every OTHER tenant is left completely untouched.
"""

import json
from contextlib import contextmanager

from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


@contextmanager
def _delete_enabled():
    s = get_settings()
    prior = s.workspace_delete_enabled
    s.workspace_delete_enabled = True
    try:
        yield
    finally:
        s.workspace_delete_enabled = prior


async def _seed_company(db):
    ws = await make_workspace(db)
    s1 = await make_session(db, ws)
    s2 = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='interview' where id in ($1,$2)", s1, s2)
    for i in range(3):
        await db.execute(
            "insert into utterances (session_id,turn_index,speaker,text) values ($1,$2,'respondent','t')", s1, i)

    plan = await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1,'COMPILED') returning id", ws)
    await db.execute("update interview_sessions set plan_id=$2 where id=$1", s1, plan)
    await db.execute(
        """insert into plan_state_transitions (plan_id, from_state, to_state, actor)
           values ($1,'DRAFT','COMPILED','admin')""", plan)
    await db.execute(
        "insert into handoff_packages (plan_id, package) values ($1,'{}')", plan)

    scrape = await db.fetchval(
        "insert into scrape_sources (workspace_id, kind, url, content) "
        "values ($1,'website','http://x','{}') returning id", ws)
    c1 = await db.fetchval(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text)
           values ($1,$2,'statement','pain','CLAIMED','a') returning id""", ws, s1)
    c2 = await db.fetchval(
        """insert into claim_records (workspace_id, scrape_source_id, kind, topic, tag, claim_text)
           values ($1,$2,'statement','time_or_cost','SCRAPED','b') returning id""", ws, scrape)
    await db.execute(
        "insert into pain_scores (claim_id, band, rationale, rater_version) values ($1,'high','x','v1')", c1)
    await db.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1,$2,$3,'worker_vs_worker','{}')""", ws, c1, c2)

    wf = await db.fetchval(
        "insert into workflows (workspace_id, session_id, name) values ($1,$2,'W') returning id", ws, s1)
    await db.execute("insert into workflow_steps (workflow_id, step_index, action) values ($1,0,'do')", wf)
    await db.execute(
        "insert into workflow_step_overlays (workflow_id, op, payload) values ($1,'soft_hide','{}')", wf)
    await db.execute("insert into workflow_sops (workflow_id, document) values ($1,'{}')", wf)

    await db.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,'learned','reported',1,$2)", ws, json.dumps({"title": "t"}))
    await db.execute(
        "insert into heuristics (workspace_id, text, falsifiable_as) values ($1,'h','if x')", ws)
    await db.execute(
        "insert into automation_opportunities (workspace_id, title, summary, claim_ids) "
        "values ($1,'o','s',$2)", ws, json.dumps([str(c1)]))
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote)
           values ($1,$2,'roster','ops','q')""", ws, s1)
    await db.execute("insert into voice_configs (workspace_id) values ($1)", ws)
    await db.execute(
        "insert into report_shares (workspace_id, token) values ($1, md5(random()::text))", ws)
    await db.execute(
        """insert into sealed_flags (workspace_id, session_id, tier, category, reviewer_summary)
           values ($1,$2,2,'safety','note')""", ws, s1)
    run = await db.fetchval(
        """insert into agent_runs (agent_name, model, prompt_version, workspace_id, session_id)
           values ('interviewer','m','v1',$1,$2) returning id""", ws, s1)
    return ws, run


async def test_delete_is_gated_off_by_default(db):
    ws, _ = await _seed_company(db)
    async with _client() as c:
        r = await c.delete(f"/api/workspaces/{ws}")
    assert r.status_code == 403
    assert await db.fetchval("select count(*) from workspaces where id=$1", ws) == 1


async def test_full_cascade_and_isolation(db):
    ws, run = await _seed_company(db)
    # A neighbour tenant with its own data — the delete must not touch it.
    other, other_run = await _seed_company(db)

    with _delete_enabled():
        async with _client() as c:
            out = (await c.delete(f"/api/workspaces/{ws}")).json()
    assert out["deleted"] is True
    assert out["removed"] == {"sessions": 2, "records": 2, "workflows": 1, "plans": 1}

    # The tenant and everything scoped to it is gone.
    assert await db.fetchval("select count(*) from workspaces where id=$1", ws) == 0
    for table in ("interview_sessions", "claim_records", "claim_conflicts", "workflows",
                  "snapshot_cards", "interview_plans", "interview_rounds", "entities",
                  "scrape_sources", "heuristics", "automation_opportunities",
                  "artifact_promises", "voice_configs", "report_shares", "sealed_flags"):
        assert await db.fetchval(f"select count(*) from {table} where workspace_id=$1", ws) == 0, table
    assert await db.fetchval("select count(*) from utterances") == 3  # only the neighbour's remain

    # Survivals: the audit run is kept, with BOTH refs nulled.
    kept = await db.fetchrow("select workspace_id, session_id from agent_runs where id=$1", run)
    assert kept is not None and kept["workspace_id"] is None and kept["session_id"] is None

    # Isolation: the neighbour tenant is fully intact.
    assert await db.fetchval("select count(*) from workspaces where id=$1", other) == 1
    assert await db.fetchval("select count(*) from claim_records where workspace_id=$1", other) == 2
    assert await db.fetchval("select count(*) from sealed_flags where workspace_id=$1", other) == 1
    assert await db.fetchval("select workspace_id from agent_runs where id=$1", other_run) == other


async def test_delete_unknown_workspace_404(db):
    with _delete_enabled():
        async with _client() as c:
            r = await c.delete("/api/workspaces/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_delete_requires_admin(db):
    from app.auth import require_admin

    ws = await make_workspace(db)
    app.dependency_overrides.pop(require_admin, None)
    try:
        with _delete_enabled():
            async with _client() as c:
                r = await c.delete(f"/api/workspaces/{ws}")
        assert r.status_code == 401
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
