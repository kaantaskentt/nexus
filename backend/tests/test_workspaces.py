"""New-company flow (A17): POST /api/workspaces mints a REAL tenant — is_demo=false,
zero records (A12 firewall), industry on the column for A14, slugs stay unique."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_create_workspace_is_real_tenant(db):
    async with _client() as c:
        r = await c.post(
            "/api/workspaces",
            json={
                "name": "Marmara Hotels Taksim",
                "industry": "hospitality",
                "website": "https://example.com",
                "contact_person": "Mine",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["is_demo"] is False
    assert body["industry"] == "hospitality"
    assert body["slug"] == "marmara-hotels-taksim"
    assert body["config"]["website"] == "https://example.com"
    assert body["config"]["contact_person"] == "Mine"

    # A12: the fresh tenant holds zero records.
    n = await db.fetchval("select count(*) from claim_records where workspace_id=$1", body["id"])
    assert n == 0
    # It appears on the picker (not internal, not demo).
    async with _client() as c:
        rows = (await c.get("/api/workspaces")).json()
    assert body["id"] in {w["id"] for w in rows}


async def test_create_workspace_slug_is_unique(db):
    async with _client() as c:
        a = (await c.post("/api/workspaces", json={"name": "Time PR"})).json()
        b = (await c.post("/api/workspaces", json={"name": "Time PR"})).json()
    assert a["slug"] == "time-pr"
    assert b["slug"] == "time-pr-2"


async def test_create_workspace_requires_name(db):
    async with _client() as c:
        r = await c.post("/api/workspaces", json={"name": "   "})
    assert r.status_code == 422


async def test_interviews_list_excludes_paste_upload_sessions(db):
    """WS-4b: a discovery paste-upload (session_kind='interview', no plan, no invite
    token) is a compile vehicle, not an interview — it must not render as a phantom row
    on the Interviews hub. Real invite-keyed and plan-backed sessions still list."""
    ws = await make_workspace(db, industry="jewelry")
    # Phantom: paste-upload shape (no plan, no token).
    await db.execute(
        "insert into interview_sessions (workspace_id, modality, status, session_kind) "
        "values ($1, 'text', 'completed', 'interview')", ws)
    # Real: invite-keyed run.
    real = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind, invite_token) "
        "values ($1, 'text', 'active', 'interview', 'tok-real-1') returning id", ws)

    async with _client() as c:
        r = await c.get(f"/api/workspaces/{ws}/sessions")
    assert r.status_code == 200
    ids = [row["id"] for row in r.json()]
    assert ids == [str(real)]
