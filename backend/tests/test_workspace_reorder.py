"""SIMPLIFY lane A — picker ordering + drag reorder (§4-A).

Default order is newest-first (created_at desc) so an untouched picker is byte-identical
to the pre-sort_order behaviour; PATCH /reorder pins the admin's arrangement via
sort_order (nulls last), and the is_internal picker filter is never bypassed.
"""

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _named(pool, name, *, is_internal=False):
    return await pool.fetchval(
        "insert into workspaces (name, slug, is_internal) values ($1, $2, $3) returning id",
        name, name.lower().replace(" ", "-"), is_internal,
    )


async def test_default_order_is_newest_first(db):
    # Inserted oldest -> newest; the picker should return newest first with null sort_order.
    a = await _named(db, "Alpha")
    b = await _named(db, "Bravo")
    c = await _named(db, "Charlie")
    async with _client() as cl:
        rows = (await cl.get("/api/workspaces")).json()
    ids = [r["id"] for r in rows]
    assert ids == [str(c), str(b), str(a)]


async def test_reorder_pins_arrangement(db):
    a = await _named(db, "Alpha")
    b = await _named(db, "Bravo")
    c = await _named(db, "Charlie")
    # Admin drags Alpha to the top, then Charlie, then Bravo.
    async with _client() as cl:
        out = (await cl.patch(
            "/api/workspaces/reorder",
            json={"ordered_ids": [str(a), str(c), str(b)]},
        )).json()
        rows = (await cl.get("/api/workspaces")).json()
    assert out == {"reordered": 3}
    assert [r["id"] for r in rows] == [str(a), str(c), str(b)]


async def test_untouched_rows_fall_to_newest_first_tail(db):
    a = await _named(db, "Alpha")
    b = await _named(db, "Bravo")
    c = await _named(db, "Charlie")  # newest
    # Only Alpha is arranged; Bravo/Charlie keep null sort_order and follow, newest-first.
    async with _client() as cl:
        await cl.patch("/api/workspaces/reorder", json={"ordered_ids": [str(a)]})
        rows = (await cl.get("/api/workspaces")).json()
    assert [r["id"] for r in rows] == [str(a), str(c), str(b)]


async def test_reorder_never_lists_internal_tenants(db):
    visible = await _named(db, "Visible")
    hidden = await _named(db, "Hidden", is_internal=True)
    async with _client() as cl:
        # Even if an internal id is sent, it stays out of the picker (filter preserved).
        await cl.patch(
            "/api/workspaces/reorder",
            json={"ordered_ids": [str(hidden), str(visible)]},
        )
        rows = (await cl.get("/api/workspaces")).json()
    ids = [r["id"] for r in rows]
    assert str(visible) in ids and str(hidden) not in ids


async def test_reorder_requires_admin(db):
    from app.auth import require_admin

    ws = await make_workspace(db)
    app.dependency_overrides.pop(require_admin, None)
    try:
        async with _client() as cl:
            r = await cl.patch("/api/workspaces/reorder", json={"ordered_ids": [str(ws)]})
        assert r.status_code == 401
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
