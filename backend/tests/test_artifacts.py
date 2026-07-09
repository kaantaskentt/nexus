"""Artifact promises (Kaan F1, July 8): the scan records genuine sharing commitments,
the respondent's by-token routes list and deliver them, the admin sees promised-vs-
delivered with the file, and non-interview sessions never produce promises."""

import base64
import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import artifacts as artifacts_pipeline
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _utter(db, sid, idx, speaker, text):
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,$3,$4)",
        sid, idx, speaker, text)


def _agent(payload: dict):
    async def _run(agent_name, content, **kw):
        assert agent_name == "artifact_promise_scan"
        return json.dumps(payload)
    return _run


async def test_scan_records_promises(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sid = await make_session(db, ws)
    await db.execute(
        "update interview_sessions set invite_token='tok-artifacts-1', session_kind='interview' where id=$1",
        sid)
    await _utter(db, sid, 0, "agent", "How do you decide client fit?")
    await _utter(db, sid, 1, "respondent", "We have an ICP doc for this. I'll send it to you.")

    monkeypatch.setattr("app.llm.run_agent", _agent({"promises": [
        {"item": "the ICP document", "objective_context": "client fit criteria",
         "quote": "We have an ICP doc for this. I'll send it to you."},
    ]}))
    await artifacts_pipeline.scan_artifact_promises({"session_id": str(sid)})

    rows = await db.fetch("select item, status, quote from artifact_promises where session_id=$1", sid)
    assert len(rows) == 1
    assert rows[0]["item"] == "the ICP document"
    assert rows[0]["status"] == "promised"
    assert "I'll send it" in rows[0]["quote"]


async def test_scan_skips_non_interview_sessions(db, monkeypatch):
    """0007 firewall posture: eval/context/demo sessions never mint client-visible promises."""
    ws = await make_workspace(db, industry="jewelry")
    sid = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='eval' where id=$1", sid)
    await _utter(db, sid, 0, "respondent", "I'll send the doc.")

    called = {"n": 0}
    async def _boom(*a, **k):
        called["n"] += 1
        return "{}"
    monkeypatch.setattr("app.llm.run_agent", _boom)
    await artifacts_pipeline.scan_artifact_promises({"session_id": str(sid)})
    assert called["n"] == 0
    assert await db.fetchval("select count(*) from artifact_promises where session_id=$1", sid) == 0


async def test_respondent_upload_and_admin_view(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sid = await make_session(db, ws)
    await db.execute(
        "update interview_sessions set invite_token='tok-artifacts-2', session_kind='interview' where id=$1",
        sid)
    aid = await db.fetchval(
        """insert into artifact_promises (workspace_id, session_id, item, objective_context, quote)
           values ($1,$2,'the ICP document','client fit','I will send it') returning id""",
        ws, sid)

    async with _client() as c:
        # Respondent sees the promise on their link…
        r = await c.get("/api/artifacts/by-token/tok-artifacts-2")
        assert r.status_code == 200
        assert r.json()[0]["status"] == "promised"

        # …uploads the file…
        blob = b"fake-pdf-bytes"
        up = await c.post(f"/api/artifacts/by-token/tok-artifacts-2/{aid}/upload", json={
            "file_name": "icp.pdf", "file_mime": "application/pdf",
            "content_base64": base64.b64encode(blob).decode(),
        })
        assert up.status_code == 200 and up.json()["status"] == "delivered"

        # …a foreign/expired token cannot touch it…
        bad = await c.post(f"/api/artifacts/by-token/tok-wrong/{aid}/upload", json={
            "file_name": "x", "file_mime": "text/plain",
            "content_base64": base64.b64encode(b"x").decode(),
        })
        assert bad.status_code == 404

        # …admin sees delivered status with provenance and downloads the exact bytes.
        admin = await c.get(f"/api/artifacts/{ws}/sessions/{sid}")
        assert admin.status_code == 200
        body = admin.json()
        assert body["invite_path"] == "/i/tok-artifacts-2"
        assert body["promises"][0]["status"] == "delivered"
        assert body["promises"][0]["quote"] == "I will send it"
        dl = await c.get(f"/api/artifacts/{ws}/file/{aid}")
        assert dl.status_code == 200 and dl.content == blob


async def test_rescan_never_clobbers_delivered(db, monkeypatch):
    """A delivered artifact is a kept promise — a later re-scan may replace undelivered
    rows but never regenerates away a delivered file."""
    ws = await make_workspace(db, industry="jewelry")
    sid = await make_session(db, ws)
    await db.execute(
        "update interview_sessions set invite_token='tok-artifacts-3', session_kind='interview' where id=$1",
        sid)
    await _utter(db, sid, 0, "respondent", "I'll send the export and the template.")
    await db.execute(
        """insert into artifact_promises (workspace_id, session_id, item, status, delivered_at,
             file_name, file_mime, file_bytes)
           values ($1,$2,'the export','delivered',now(),'e.csv','text/csv',$3)""",
        ws, sid, b"a,b")
    await db.execute(
        "insert into artifact_promises (workspace_id, session_id, item) values ($1,$2,'stale promise')",
        ws, sid)

    monkeypatch.setattr("app.llm.run_agent", _agent({"promises": [
        {"item": "the template", "objective_context": "daily flow", "quote": "I'll send the template"},
    ]}))
    await artifacts_pipeline.scan_artifact_promises({"session_id": str(sid)})

    rows = await db.fetch(
        "select item, status from artifact_promises where session_id=$1 order by item", sid)
    items = {r["item"]: r["status"] for r in rows}
    assert items == {"the export": "delivered", "the template": "promised"}
