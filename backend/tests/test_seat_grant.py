"""Grant / list / revoke workspace seats (People → workspace access)."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.seats import grant_workspace_seat, list_workspace_seats, revoke_workspace_seat
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_grant_list_revoke_seat(db):
    ws = await make_workspace(db)
    ent = await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, role, source) "
        "values ($1,'person','James Hunt','Founder','manual') returning id",
        ws,
    )

    out = await grant_workspace_seat(
        str(ws),
        email="james@cambridge.example",
        entity_id=str(ent),
        display_name="James Hunt",
    )
    assert out["email"] == "james@cambridge.example"
    assert out["role"] == "client"
    assert out["workspace_id"] == str(ws)
    assert out["entity_id"] == str(ent)
    assert out["created"] is True
    assert out["temporary_password"]  # minted (no auth schema in test)

    seats = await list_workspace_seats(str(ws))
    assert len(seats) == 1
    assert seats[0]["user_id"] == out["user_id"]

    # Idempotent re-grant — no second password, same seat.
    again = await grant_workspace_seat(
        str(ws), email="james@cambridge.example", entity_id=str(ent)
    )
    assert again["created"] is False
    assert again["temporary_password"] is None
    assert again["user_id"] == out["user_id"]

    rev = await revoke_workspace_seat(str(ws), out["user_id"])
    assert rev["ok"] is True
    assert await list_workspace_seats(str(ws)) == []


async def test_grant_rejects_cross_workspace_seat(db):
    ws_a = await make_workspace(db)
    ws_b = await make_workspace(db)
    first = await grant_workspace_seat(str(ws_a), email="ceo@a.example")
    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as ei:
        await grant_workspace_seat(str(ws_b), email="ceo@a.example")
    assert ei.value.status_code == 409

    # Cleanup not required — drop schema between tests.


async def test_seats_http_routes(db):
    ws = await make_workspace(db)
    async with _client() as c:
        granted = await c.post(
            f"/api/workspaces/{ws}/seats",
            json={"email": "ops@example.com", "name": "Ops Lead"},
        )
        assert granted.status_code == 200
        body = granted.json()
        assert body["email"] == "ops@example.com"
        listed = await c.get(f"/api/workspaces/{ws}/seats")
        assert listed.status_code == 200
        assert len(listed.json()) == 1
        deleted = await c.delete(f"/api/workspaces/{ws}/seats/{body['user_id']}")
        assert deleted.status_code == 200
        assert (await c.get(f"/api/workspaces/{ws}/seats")).json() == []
