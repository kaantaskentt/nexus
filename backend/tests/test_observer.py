"""Observer view backend (A19). Pins the honesty contract: real utterances only, coverage
None means "not tracked" (never fabricated), Add-insight rows are CLAIMED at the data
layer (a stronger tag is a DB error, not a style choice), and cross-tenant session ids 404."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _session(db, ws, **cols):
    if cols.get("resumable_state") is not None:
        return await db.fetchval(
            "insert into interview_sessions (workspace_id, modality, status, resumable_state) "
            "values ($1, 'voice', $2, $3) returning id",
            ws, cols.get("status", "active"), cols["resumable_state"],
        )
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status) "
        "values ($1, 'voice', $2) returning id",
        ws, cols.get("status", "active"),
    )


async def test_observe_returns_real_transcript_and_untracked_coverage(db):
    ws = await make_workspace(db, industry="jewelry")
    sid = await _session(db, ws)
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) values "
        "($1, 0, 'agent', 'Hi, thanks for taking the time.'), "
        "($1, 1, 'respondent', 'Sure. So, um, mornings are mostly orders.')",
        sid,
    )
    async with _client() as c:
        r = await c.get(f"/api/observer/{ws}/sessions/{sid}")
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["status"] == "active"
    # Verbatim transcript, in turn order, with timestamps.
    assert [u["speaker"] for u in body["utterances"]] == ["agent", "respondent"]
    assert body["utterances"][1]["text"] == "Sure. So, um, mornings are mostly orders."
    assert body["utterances"][0]["at"]
    # No coverage was ever computed => None + the flag state, never an empty ring.
    assert body["coverage"] is None
    assert body["coverage_tracking_enabled"] is False
    assert body["insights"] == []
    assert body["claims"] == []


async def test_observe_surfaces_engine_coverage_when_present(db):
    import json

    ws = await make_workspace(db, industry="jewelry")
    cov = {"objectives": [{"label": "daily flow", "status": "satisfied"}]}
    sid = await _session(db, ws, resumable_state=json.dumps(
        {"objectives": ["daily flow"], "coverage": cov}
    ))
    async with _client() as c:
        r = await c.get(f"/api/observer/{ws}/sessions/{sid}")
    body = r.json()
    assert body["objectives"] == ["daily flow"]
    assert body["coverage"] == cov  # exactly what the engine stored, no reshaping


async def test_add_insight_is_claimed_at_the_data_layer(db):
    ws = await make_workspace(db, industry="jewelry")
    sid = await _session(db, ws)
    async with _client() as c:
        r = await c.post(f"/api/observer/{ws}/sessions/{sid}/insights",
                         json={"text": "  Orders pile up before lunch.  "})
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "Orders pile up before lunch."  # trimmed, verbatim otherwise
    assert body["trust_tag"] == "CLAIMED"
    assert body["at"]

    # The 0010 check constraint refuses anything stronger — enforcement, not convention.
    import asyncpg
    try:
        await db.execute(
            "insert into observer_insights (session_id, text, trust_tag) values ($1, 'x', 'VERIFIED')",
            sid,
        )
        raise AssertionError("a VERIFIED live insight must be a DB error")
    except asyncpg.CheckViolationError:
        pass


async def test_observe_scopes_sessions_to_the_workspace(db):
    ws_a = await make_workspace(db, industry="jewelry")
    ws_b = await make_workspace(db, industry="coffee")
    sid_b = await _session(db, ws_b)
    async with _client() as c:
        r = await c.get(f"/api/observer/{ws_a}/sessions/{sid_b}")
        r2 = await c.post(f"/api/observer/{ws_a}/sessions/{sid_b}/insights", json={"text": "x"})
    assert r.status_code == 404
    assert r2.status_code == 404
