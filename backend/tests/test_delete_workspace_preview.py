"""SIMPLIFY lane A — company-delete PREVIEW (non-destructive half, §4-A/§6-1).

The preview counts EXACTLY what a company delete would remove (the type-to-confirm dialog
is the feature) and reports the retained agent-run audit count separately. This is
read-only: no destructive endpoint is exercised or exists on this path yet.
"""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _seed_company(db):
    """A workspace carrying one of (nearly) every scoped artifact, so the preview counts
    can be asserted exactly."""
    ws = await make_workspace(db)
    s1 = await make_session(db, ws)
    s2 = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='interview' where id in ($1,$2)", s1, s2)
    for i in range(3):
        await db.execute(
            "insert into utterances (session_id,turn_index,speaker,text) values ($1,$2,'respondent','t')",
            s1, i)

    plan = await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1,'COMPILED') returning id", ws)
    await db.execute("update interview_sessions set plan_id=$2 where id=$1", s1, plan)
    await db.execute(
        """insert into plan_state_transitions (plan_id, from_state, to_state, actor)
           values ($1,'DRAFT','COMPILED','admin')""", plan)

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
    await db.execute(
        "insert into workflow_steps (workflow_id, step_index, action) values ($1,0,'do')", wf)
    await db.execute(
        "insert into workflow_steps (workflow_id, step_index, action) values ($1,1,'do2')", wf)
    await db.execute(
        "insert into workflow_sops (workflow_id, document) values ($1,'{}')", wf)

    await db.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,'learned','reported',1,$2)", ws, json.dumps({"title": "t"}))
    await db.execute(
        "insert into heuristics (workspace_id, text, falsifiable_as) values ($1,'h','if x then y')", ws)
    await db.execute(
        "insert into automation_opportunities (workspace_id, title, summary, claim_ids) "
        "values ($1,'o','s',$2)", ws, json.dumps([str(c1)]))
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote)
           values ($1,$2,'roster','ops','q')""", ws, s1)
    await db.execute(
        "insert into voice_configs (workspace_id) values ($1)", ws)
    await db.execute(
        """insert into sealed_flags (workspace_id, session_id, tier, category, reviewer_summary)
           values ($1,$2,2,'safety','note')""", ws, s1)
    await db.execute(
        """insert into agent_runs (agent_name, model, prompt_version, workspace_id, session_id)
           values ('interviewer','m','v1',$1,$2)""", ws, s1)
    return ws


async def test_preview_counts_exactly(db):
    ws = await _seed_company(db)
    async with _client() as c:
        p = (await c.get(f"/api/workspaces/{ws}/delete-preview")).json()
    assert p["name"] == "Test Co"
    assert p["sessions"] == 2
    assert p["turns"] == 3
    assert p["records"] == 2
    assert p["conflicts"] == 1
    assert p["pain_scores"] == 1
    assert p["workflows"] == 1
    assert p["workflow_steps"] == 2
    assert p["sops"] == 1
    assert p["snapshot_cards"] == 1
    assert p["plans"] == 1
    assert p["plan_transitions"] == 1
    assert p["scrape_sources"] == 1
    assert p["heuristics"] == 1
    assert p["promises"] == 1
    assert p["opportunities"] == 1
    assert p["voice_config"] == 1
    assert p["sealed_flags"] == 1
    assert p["retained_agent_runs"] == 1


async def test_preview_empty_company_is_all_zero(db):
    ws = await make_workspace(db)
    async with _client() as c:
        p = (await c.get(f"/api/workspaces/{ws}/delete-preview")).json()
    for key in ("sessions", "turns", "records", "workflows", "snapshot_cards",
                "entities", "sealed_flags", "retained_agent_runs"):
        assert p[key] == 0


async def test_preview_unknown_workspace_404(db):
    async with _client() as c:
        r = await c.get("/api/workspaces/00000000-0000-0000-0000-000000000000/delete-preview")
    assert r.status_code == 404


async def test_preview_requires_admin(db):
    from app.auth import require_admin

    ws = await make_workspace(db)
    app.dependency_overrides.pop(require_admin, None)
    try:
        async with _client() as c:
            r = await c.get(f"/api/workspaces/{ws}/delete-preview")
        assert r.status_code == 401
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
