"""SIMPLIFY B: the one-time 'company snapshot ready' intro dismissal persists in
workspaces.config (same jsonb-merge path as the pulse toggle) and preserves other keys."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_mark_snapshot_intro_seen_persists_and_preserves_config(db):
    ws = await make_workspace(db)
    await db.execute(
        "update workspaces set config = $2 where id = $1",
        ws, json.dumps({"weekly_pulse": True}),
    )
    async with _client() as c:
        r = await c.post(f"/api/workspaces/{ws}/snapshot-intro-seen")
        assert r.status_code == 200
        assert r.json() == {"snapshot_intro_seen": True}

    cfg = await db.fetchval("select config from workspaces where id = $1", ws)
    cfg = json.loads(cfg) if isinstance(cfg, str) else cfg
    assert cfg["snapshot_intro_seen"] is True
    assert cfg["weekly_pulse"] is True  # existing keys survive the merge


async def test_mark_snapshot_intro_seen_404_on_bogus_workspace(db):
    async with _client() as c:
        r = await c.post(
            "/api/workspaces/00000000-0000-0000-0000-000000000000/snapshot-intro-seen"
        )
        assert r.status_code == 404
