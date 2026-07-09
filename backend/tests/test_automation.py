"""Automation opportunities (Kaan F2+3): evidence-only, structurally enforced —
zero-citation opportunities never store (Kaan (e)), workflow/step refs validate against
the real fold, ROI is always an is_estimate object with its assumption text."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import automation
from tests.conftest import make_session, make_workspace


def _agent(payload: dict):
    async def _run(agent_name, content, **kw):
        assert agent_name == "automation_assessor"
        return json.dumps(payload)
    return _run


async def test_uncited_opportunities_are_dropped_and_roi_is_estimate(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    cid = await db.fetchval(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, evidence_quote) "
        "values ($1,$2,'statement','time_or_cost','CONFIRMED',"
        "'Morning repricing takes about two hours','takes him maybe two hours') returning id",
        ws, sess)

    monkeypatch.setattr("app.llm.run_agent", _agent({"opportunities": [
        {"title": "Morning repricing", "summary": "Manual spreadsheet repricing every morning.",
         "signals": ["manual", "repetitive"], "claim_ids": [str(cid)],
         "workflow_id": None, "step_ids": [],
         "roi": {"assumption": "assuming the two hours described happens every weekday",
                 "low_hours_month": 30, "high_hours_month": 45,
                 "duration_claim_ids": [str(cid)]}},
        {"title": "Invented toil", "summary": "No evidence at all.",
         "signals": ["manual"], "claim_ids": ["00000000-0000-0000-0000-000000000000"],
         "workflow_id": None, "step_ids": [], "roi": None},
        {"title": "Assumptionless ROI", "summary": "Cited but its ROI hides its assumptions.",
         "signals": ["repetitive"], "claim_ids": [str(cid)],
         "workflow_id": None, "step_ids": [],
         "roi": {"assumption": "", "low_hours_month": 1, "high_hours_month": 2,
                 "duration_claim_ids": []}},
    ]}))
    await automation.assess_automation({"workspace_id": str(ws)})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get(f"/api/workspaces/{ws}/automation")
    body = r.json()
    titles = {o["title"] for o in body}
    assert "Invented toil" not in titles              # zero valid citations -> dropped
    first = next(o for o in body if o["title"] == "Morning repricing")
    assert first["claim_ids"] == [str(cid)]
    assert first["roi"]["is_estimate"] is True        # structural, not styling
    assert first["roi"]["duration_claim_ids"] == [str(cid)]  # real duration, cited
    second = next(o for o in body if o["title"] == "Assumptionless ROI")
    assert second["roi"] is None                      # estimate without assumptions dropped
