"""Robustness 1 (lane 5.3): the delete cascade cancels a session's not-yet-run jobs in the
same transaction, so no orphaned post-call work survives the delete. Covers both the
interview delete and the (inert) company delete."""

import json

from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _queue_job(pool, kind, *, session_id=None, workspace_id=None, status="queued"):
    payload = {}
    if session_id is not None:
        payload["session_id"] = str(session_id)
    if workspace_id is not None:
        payload["workspace_id"] = str(workspace_id)
    return await pool.fetchval(
        "insert into jobs (kind, payload, status) values ($1,$2,$3) returning id",
        kind, json.dumps(payload), status)


async def test_interview_delete_cancels_its_queued_jobs(db):
    ws = await make_workspace(db)
    doomed = await make_session(db, ws)
    survivor = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='interview' where id in ($1,$2)",
                     doomed, survivor)
    j_doomed = await _queue_job(db, "compute_yield", session_id=doomed)
    j_doomed2 = await _queue_job(db, "screen_disclosures", session_id=doomed)
    j_done = await _queue_job(db, "compute_yield", session_id=doomed, status="done")
    j_survivor = await _queue_job(db, "compute_yield", session_id=survivor)

    async with _client() as c:
        r = await c.delete(f"/api/sessions/{doomed}")
    assert r.status_code == 200

    # The doomed session's queued jobs are gone; a terminal (done) job is left as history;
    # the neighbour's job is untouched.
    assert await db.fetchval("select count(*) from jobs where id=$1", j_doomed) == 0
    assert await db.fetchval("select count(*) from jobs where id=$1", j_doomed2) == 0
    assert await db.fetchval("select count(*) from jobs where id=$1", j_done) == 1
    assert await db.fetchval("select count(*) from jobs where id=$1", j_survivor) == 1


async def test_workspace_delete_cancels_session_and_workspace_jobs(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    other_ws = await make_workspace(db)
    other_sess = await make_session(db, other_ws)

    j_sess = await _queue_job(db, "compute_yield", session_id=sess)
    j_ws = await _queue_job(db, "render_snapshot", workspace_id=ws)
    j_other = await _queue_job(db, "compute_yield", session_id=other_sess)
    j_other_ws = await _queue_job(db, "render_snapshot", workspace_id=other_ws)

    s = get_settings()
    prior = s.workspace_delete_enabled
    s.workspace_delete_enabled = True
    try:
        async with _client() as c:
            r = await c.delete(f"/api/workspaces/{ws}")
        assert r.status_code == 200
    finally:
        s.workspace_delete_enabled = prior

    assert await db.fetchval("select count(*) from jobs where id=$1", j_sess) == 0
    assert await db.fetchval("select count(*) from jobs where id=$1", j_ws) == 0
    # The other tenant's queued work is untouched.
    assert await db.fetchval("select count(*) from jobs where id=$1", j_other) == 1
    assert await db.fetchval("select count(*) from jobs where id=$1", j_other_ws) == 1
