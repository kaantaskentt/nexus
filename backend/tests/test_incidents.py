"""R6 harm-incident inbox (Kaan ruling). The reviewer-scoped admin surface lists the
minimized incident rows and lets the reviewer acknowledge/dismiss. Asserts: the list carries
the minimized fields + workspace name and NO verbatim, the filter works, review records the
actor+time, and the not-found / bad-action guards hold."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _incident(pool, ws, sess, *, category="illegality", bucket="amber", notify="skipped"):
    return await pool.fetchval(
        """insert into harm_incidents (workspace_id, session_id, category, bucket, notify_status)
           values ($1, $2, $3, $4, $5) returning id""",
        ws, sess, category, bucket, notify,
    )


async def test_list_returns_minimized_incident_with_workspace(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    inc = await _incident(db, ws, sess, category="safety", bucket="amber")

    async with _client() as c:
        r = await c.get("/api/incidents")
    assert r.status_code == 200
    items = r.json()["incidents"]
    assert len(items) == 1
    row = items[0]
    assert row["id"] == str(inc)
    assert row["category"] == "safety" and row["bucket"] == "amber"
    assert row["session_id"] == str(sess) and row["workspace_name"] == "Test Co"
    assert row["review_status"] == "unreviewed" and row["notify_status"] == "skipped"
    # The whole point: the inbox carries no verbatim disclosure content.
    assert not ({"reviewer_summary", "text", "turn_refs", "verbatim"} & set(row.keys()))


async def test_review_records_actor_and_time(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    inc = await _incident(db, ws, sess)

    async with _client() as c:
        r = await c.post(f"/api/incidents/{inc}/review", json={"action": "reviewed"})
    assert r.status_code == 200 and r.json()["review_status"] == "reviewed"

    row = await db.fetchrow(
        "select review_status, reviewed_by, reviewed_at from harm_incidents where id = $1", inc)
    assert row["review_status"] == "reviewed"
    assert row["reviewed_by"] == "test-admin" and row["reviewed_at"] is not None


async def test_status_filter(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    a = await _incident(db, ws, sess)
    await _incident(db, ws, sess)
    await db.execute("update harm_incidents set review_status='reviewed' where id=$1", a)

    async with _client() as c:
        unreviewed = (await c.get("/api/incidents", params={"status": "unreviewed"})).json()["incidents"]
        reviewed = (await c.get("/api/incidents", params={"status": "reviewed"})).json()["incidents"]
    assert len(unreviewed) == 1 and len(reviewed) == 1
    assert reviewed[0]["id"] == str(a)


async def test_review_guards(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    inc = await _incident(db, ws, sess)
    async with _client() as c:
        bad = await c.post(f"/api/incidents/{inc}/review", json={"action": "nuke"})
        missing = await c.post(
            "/api/incidents/00000000-0000-0000-0000-000000000000/review",
            json={"action": "reviewed"})
    assert bad.status_code == 422
    assert missing.status_code == 404


async def test_inbox_requires_admin(db):
    """The router is registered under the blanket require_admin gate. With the conftest
    override popped, the list route rejects an unauthenticated caller."""
    from app.auth import require_admin

    app.dependency_overrides.pop(require_admin, None)
    try:
        async with _client() as c:
            r = await c.get("/api/incidents")
        assert r.status_code in (401, 403)
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
