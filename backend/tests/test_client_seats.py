"""F6 client seats. Explicit user_roles rows always bind (grant-safe). No row ⇒ admin."""

from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient

from app import auth
from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _seat(db, ws, user_id="client-user-1", role="client"):
    await db.execute(
        "insert into user_roles (user_id, email, role, workspace_id) values ($1,$2,$3,$4) "
        "on conflict (user_id) do update set role = $3, workspace_id = $4",
        user_id, f"{user_id}@t", role, ws,
    )


async def test_explicit_client_row_scopes_workspace(db, monkeypatch):
    """A client seat row always scopes — CLIENT_SEATS flag is not a bypass."""
    monkeypatch.setattr(auth, "get_settings", lambda: SimpleNamespace(client_seats=False))
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    await _seat(db, ws_a, user_id="test-admin")  # conftest override returns "test-admin"
    async with _client() as c:
        picker = await c.get("/api/workspaces")
        own = await c.get(f"/api/workspaces/{ws_a}/snapshot")
        other = await c.get(f"/api/workspaces/{ws_b}/snapshot")
        me = await c.get("/api/me")
    assert [w["id"] for w in picker.json()] == [str(ws_a)]
    assert own.status_code == 200
    assert other.status_code == 403
    assert me.json() == {
        "user_id": "test-admin",
        "role": "client",
        "workspace_id": str(ws_a),
    }


async def test_user_without_row_stays_admin(db):
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    async with _client() as c:
        picker = await c.get("/api/workspaces")
        other = await c.get(f"/api/workspaces/{ws_b}/snapshot")
        me = await c.get("/api/me")
    ids = {w["id"] for w in picker.json()}
    assert str(ws_a) in ids and str(ws_b) in ids
    assert other.status_code == 200
    assert me.json()["role"] == "admin"


async def test_client_seat_requires_workspace_constraint(db):
    import asyncpg
    import pytest

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "insert into user_roles (user_id, role) values ('x', 'client')"
        )
