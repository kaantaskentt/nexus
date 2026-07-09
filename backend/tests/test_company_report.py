"""Company Report export (F2 Monday Morning Report): mint is idempotent and admin-gated,
the by-token compose is public, role-only (no speaker names anywhere in the payload),
versioned, and derives next steps from the live snapshot instead of storing content."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _claim(pool, ws, session_id, text, **over):
    cols = dict(kind="statement", topic="process_step", tag="CLAIMED", evidence_quote=None)
    cols.update(over)
    return await pool.fetchval(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, evidence_quote)
           values ($1,$2,$3,$4,$5,$6,$7) returning id""",
        ws, session_id, cols["kind"], cols["topic"], cols["tag"], text, cols["evidence_quote"],
    )


async def _card(pool, ws, card_type, content):
    await pool.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,$2,'reported',1,$3)",
        ws, card_type, json.dumps(content),
    )


async def test_mint_is_idempotent(db):
    ws = await make_workspace(db)
    async with _client() as c:
        r1 = await c.post(f"/api/company-report/{ws}/share")
        r2 = await c.post(f"/api/company-report/{ws}/share")
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["token"] == r2.json()["token"]
    assert r1.json()["path"] == f"/r/{r1.json()['token']}"


async def test_mint_404_on_bogus_workspace(db):
    async with _client() as c:
        r = await c.post("/api/company-report/00000000-0000-0000-0000-000000000000/share")
    assert r.status_code == 404


async def test_by_token_composes_role_only(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)

    pain = await _claim(db, ws, sess, "Returns pile up every morning", topic="pain",
                        tag="CONFIRMED", evidence_quote="it is a nightmare")
    await db.execute(
        "insert into pain_scores (claim_id, band, rationale, rater_version) values ($1,'high','x','v1')",
        pain)
    a = await _claim(db, ws, sess, "40 minutes", topic="time_or_cost", tag="CLAIMED")
    b = await _claim(db, ws, sess, "two hours", topic="time_or_cost", tag="CONFIRMED")
    await db.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1,$2,$3,'perception_gap',$4)""",
        ws, a, b, json.dumps({"gap": "leadership believes 40m; floor lives 2h"}))

    await _card(db, ws, "area_to_investigate", {"title": "Where returns stall"})
    await _card(db, ws, "suggested_person", {"name": "Baris", "role": "Delivery driver"})

    async with _client() as c:
        mint = (await c.post(f"/api/company-report/{ws}/share")).json()
        r = await c.get(f"/api/company-report/by-token/{mint['token']}")
    assert r.status_code == 200
    body = r.json()

    assert body["shape"] == "company_report.v1"
    assert body["company"]["industry"] == "jewelry"
    assert len(body["gaps"]) == 1
    assert body["gaps"][0]["note"] == "leadership believes 40m; floor lives 2h"
    assert any(f["text"] == "Returns pile up every morning" and f["band"] == "high"
               for f in body["key_findings"])
    kinds = {s["kind"] for s in body["next_steps"]}
    assert "investigate" in kinds and "interview" in kinds

    # ROLE-ONLY: no "speaker" key may appear anywhere in the export payload.
    def _no_speaker(node):
        if isinstance(node, dict):
            assert "speaker" not in node
            for v in node.values():
                _no_speaker(v)
        elif isinstance(node, list):
            for v in node:
                _no_speaker(v)
    _no_speaker(body)


async def test_by_token_unknown_or_revoked_404(db):
    ws = await make_workspace(db)
    async with _client() as c:
        mint = (await c.post(f"/api/company-report/{ws}/share")).json()
        await db.execute("update report_shares set revoked_at = now() where token = $1",
                         mint["token"])
        revoked = await c.get(f"/api/company-report/by-token/{mint['token']}")
        unknown = await c.get("/api/company-report/by-token/not-a-token")
    assert revoked.status_code == 404
    assert unknown.status_code == 404


async def test_mint_requires_admin(db):
    """The mint route sits on the public-prefixed router — prove its per-route gate."""
    from app.auth import require_admin

    ws = await make_workspace(db)
    app.dependency_overrides.pop(require_admin, None)  # drop the conftest bypass
    try:
        async with _client() as c:
            r = await c.post(f"/api/company-report/{ws}/share")
        assert r.status_code == 401
    finally:
        app.dependency_overrides[require_admin] = lambda: "test-admin"
