"""Lane 5.3 picker N+1 fix: GET /api/workspaces returns the per-workspace counts the picker
needs (plans_count, areas_count in the latest snapshot batch, prepared) in ONE aggregate,
so the root page no longer fans out list_plans + list_snapshot_cards per workspace. The
`prepared` flag must stay byte-identical to the old "latest batch non-empty" so the hero
guard is unchanged."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _card(pool, ws, card_type, batch):
    await pool.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,$2,'reported',$3,$4)", ws, card_type, batch, json.dumps({"title": "t"}))


async def test_counts_are_aggregated_in_one_call(db):
    ws = await make_workspace(db)
    for _ in range(2):
        await db.execute("insert into interview_plans (workspace_id, state) values ($1,'COMPILED')", ws)
    await _card(db, ws, "area_to_investigate", 1)
    await _card(db, ws, "area_to_investigate", 1)
    await _card(db, ws, "learned", 1)

    async with _client() as c:
        row = next(r for r in (await c.get("/api/workspaces")).json() if r["id"] == str(ws))
    assert row["plans_count"] == 2
    assert row["areas_count"] == 2
    assert row["prepared"] is True


async def test_empty_workspace_is_not_prepared(db):
    ws = await make_workspace(db)
    async with _client() as c:
        row = next(r for r in (await c.get("/api/workspaces")).json() if r["id"] == str(ws))
    assert row["plans_count"] == 0 and row["areas_count"] == 0 and row["prepared"] is False


async def test_areas_count_reflects_only_the_latest_batch(db):
    ws = await make_workspace(db)
    await _card(db, ws, "area_to_investigate", 1)
    await _card(db, ws, "area_to_investigate", 1)
    await _card(db, ws, "area_to_investigate", 2)  # newer batch: only this one counts
    async with _client() as c:
        row = next(r for r in (await c.get("/api/workspaces")).json() if r["id"] == str(ws))
    assert row["areas_count"] == 1 and row["prepared"] is True
