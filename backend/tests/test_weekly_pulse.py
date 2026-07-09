"""Weekly Pulse (F3): OFF by default, per-workspace toggle, deterministic 7-day digest
(records delta, conflicts, promises kept/pending, one next step) and a forwardable
WhatsApp text with role-only attribution."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _claim(pool, ws, sess, text, *, days_ago=0, tag="CLAIMED", topic="pain"):
    return await pool.fetchval(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, created_at)
           values ($1,$2,'statement',$3,$4,$5, now() - ($6 || ' days')::interval) returning id""",
        ws, sess, topic, tag, text, str(days_ago),
    )


async def test_pulse_toggle_off_by_default(db):
    ws = await make_workspace(db)
    async with _client() as c:
        r = await c.get(f"/api/workspaces/{ws}/pulse")
        assert r.json()["enabled"] is False
        on = await c.put(f"/api/workspaces/{ws}/pulse-config", json={"enabled": True})
        assert on.json() == {"enabled": True}
        r2 = await c.get(f"/api/workspaces/{ws}/pulse")
        assert r2.json()["enabled"] is True
    # Other config keys survive the flip.
    cfg = await db.fetchval("select config from workspaces where id = $1", ws)
    cfg = json.loads(cfg) if isinstance(cfg, str) else cfg
    assert cfg["weekly_pulse"] is True


async def test_pulse_digest_windows_and_text(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    await _claim(db, ws, sess, "Returns pile up every morning")
    await _claim(db, ws, sess, "Ancient history claim", days_ago=8)
    a = await _claim(db, ws, sess, "40 minutes", topic="time_or_cost")
    b = await _claim(db, ws, sess, "two hours", topic="time_or_cost", tag="CONFIRMED")
    await db.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1,$2,$3,'perception_gap',$4)""",
        ws, a, b, json.dumps({"gap": "belief says 40m; the floor lives 2h"}))
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote, status, delivered_at)
           values ($1,$2,'the ICP document','fit','q','delivered', now())""", ws, sess)
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote)
           values ($1,$2,'the returns spreadsheet','returns','q2')""", ws, sess)
    await db.execute(
        "insert into snapshot_cards (workspace_id, card_type, confidence, render_batch, content) "
        "values ($1,'area_to_investigate','reported',1,$2)",
        ws, json.dumps({"title": "Where returns stall"}))

    async with _client() as c:
        body = (await c.get(f"/api/workspaces/{ws}/pulse")).json()

    t = body["totals"]
    assert t["new_records"] == 3          # the 8-day-old claim is outside the window
    assert t["new_conflicts"] == 1
    assert t["promises_kept"] == 1 and t["promises_pending"] == 1
    assert body["next_step"] == "Investigate: Where returns stall"

    text = body["whatsapp_text"]
    assert text.startswith("*Test Co weekly pulse*")
    assert "belief says 40m" in text
    assert "pending: the returns spreadsheet" in text
    assert "Suggested next step: Investigate: Where returns stall" in text
    assert "Ancient history" not in text
    assert "—" not in text  # no em-dashes in client-facing copy


async def test_pulse_404_on_bogus_workspace(db):
    async with _client() as c:
        r = await c.get("/api/workspaces/00000000-0000-0000-0000-000000000000/pulse")
        w = await c.put("/api/workspaces/00000000-0000-0000-0000-000000000000/pulse-config",
                        json={"enabled": True})
    assert r.status_code == 404 and w.status_code == 404
