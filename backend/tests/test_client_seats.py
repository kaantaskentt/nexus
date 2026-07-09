"""F6 client seats (DORMANT). The load-bearing tests are the dormancy ones: with
CLIENT_SEATS off (the shipped default), a user WITH a client row still behaves as an
admin, because the seat layer never reads the table. Flag on: the seat scopes the
picker and workspace routes to its own workspace."""

from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient

from app import auth
from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


def _flag(monkeypatch, on: bool):
    # resolve_seat reads only client_seats from settings — a namespace is enough.
    monkeypatch.setattr(auth, "get_settings", lambda: SimpleNamespace(client_seats=on))


async def _seat(db, ws, user_id="client-user-1", role="client"):
    await db.execute(
        "insert into user_roles (user_id, email, role, workspace_id) values ($1,$2,$3,$4) "
        "on conflict (user_id) do update set role = $3, workspace_id = $4",
        user_id, f"{user_id}@t", role, ws,
    )


async def test_dormant_flag_off_ignores_client_rows(db, monkeypatch):
    """The shipped default: even with a client row present, everything is admin."""
    _flag(monkeypatch, False)
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    await _seat(db, ws_a, user_id="test-admin")  # conftest override returns "test-admin"
    async with _client() as c:
        picker = await c.get("/api/workspaces")
        other = await c.get(f"/api/workspaces/{ws_b}/snapshot")
        me = await c.get("/api/me")
    ids = {w["id"] for w in picker.json()}
    assert str(ws_a) in ids and str(ws_b) in ids  # full picker, no scoping
    assert other.status_code == 200
    assert me.json()["role"] == "admin"


async def test_flag_on_scopes_client_to_own_workspace(db, monkeypatch):
    _flag(monkeypatch, True)
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    await _seat(db, ws_a, user_id="test-admin")
    async with _client() as c:
        picker = await c.get("/api/workspaces")
        own = await c.get(f"/api/workspaces/{ws_a}/snapshot")
        other = await c.get(f"/api/workspaces/{ws_b}/snapshot")
        other_claims = await c.get(f"/api/claims/{ws_b}")
        me = await c.get("/api/me")
    assert [w["id"] for w in picker.json()] == [str(ws_a)]
    assert own.status_code == 200
    assert other.status_code == 403
    assert other_claims.status_code == 403
    assert me.json() == {"user_id": "test-admin", "role": "client", "workspace_id": str(ws_a)}


async def test_flag_on_user_without_row_stays_admin(db, monkeypatch):
    """We are the only users right now: no row = admin even with the flag on."""
    _flag(monkeypatch, True)
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    async with _client() as c:
        picker = await c.get("/api/workspaces")
        other = await c.get(f"/api/workspaces/{ws_b}/snapshot")
    ids = {w["id"] for w in picker.json()}
    assert str(ws_a) in ids and str(ws_b) in ids
    assert other.status_code == 200


async def test_client_seat_requires_workspace_constraint(db):
    import asyncpg
    import pytest

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "insert into user_roles (user_id, role) values ('x', 'client')"
        )
