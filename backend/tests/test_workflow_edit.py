"""Workflow editor (V2 #21). The ontology invariants under test: claim-derived steps
are never mutated (edits are append-only overlays), every edit carries prior_value
provenance, a remove is a reversible soft_hide, manual steps render as source='manual',
the blueprint is non-executable with all 10 slots, and the SOP folds the edits (agent
mocked). Runs against the throwaway container, never a real tenant (A12)."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import workflow_edit
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _workflow(db, ws, session_id):
    wid = await db.fetchval(
        "insert into workflows (workspace_id, session_id, name) values ($1,$2,'Repricing') returning id",
        ws, session_id,
    )
    for i, action in enumerate(["Open the Excel", "Reprice items", "Publish updates"]):
        await db.execute(
            "insert into workflow_steps (workflow_id, step_index, action, tool, verified, spine_slots) "
            "values ($1,$2,$3,'Excel','partial',$4)",
            wid, i, action, json.dumps({"task": action, "trigger": "each morning"}),
        )
    return str(wid)


async def test_edits_are_overlays_base_never_mutated_and_provenance_kept(db):
    ws = await make_workspace(db, is_demo=True, industry="jewelry")
    sid = await make_session(db, ws)
    wid = await _workflow(db, ws, sid)

    async with _client() as c:
        eff = (await c.get(f"/api/workflows/{wid}/effective")).json()
        assert [s["source"] for s in eff["steps"]] == ["claim_derived"] * 3
        s0 = eff["steps"][0]["step_id"]
        base_action_before = await db.fetchval("select action from workflow_steps where id=$1", s0)

        # rename → overlay, effective changes, base row UNTOUCHED, prior_value captured
        r = await c.post(f"/api/workflows/{wid}/edit", json={
            "op": "rename", "step_id": s0, "payload": {"field": "action", "value": "Open Burak's Excel"}})
        assert r.status_code == 200
        eff = r.json()["effective"]
        renamed = next(s for s in eff["steps"] if s["step_id"] == s0)
        assert renamed["action"] == "Open Burak's Excel"
        assert renamed["edited"] is True
        prior = [e for e in renamed["provenance"]["edits"] if e["op"] == "rename"][0]["prior_value"]
        assert prior == {"action": base_action_before}
        # the claim-derived truth is immutable
        assert await db.fetchval("select action from workflow_steps where id=$1", s0) == base_action_before

    # nothing was UPDATEd on workflow_steps; the edit lives only as an overlay row
    assert await db.fetchval("select count(*) from workflow_step_overlays where workflow_id=$1", wid) == 1


async def test_manual_step_and_reversible_soft_hide(db):
    ws = await make_workspace(db, is_demo=True)
    sid = await make_session(db, ws)
    wid = await _workflow(db, ws, sid)

    async with _client() as c:
        eff = (await c.get(f"/api/workflows/{wid}/effective")).json()
        s1 = eff["steps"][1]["step_id"]

        # add a manual step — exists only as an overlay, tagged source='manual'
        eff = (await c.post(f"/api/workflows/{wid}/edit", json={
            "op": "add_manual",
            "payload": {"action": "Reconcile returns", "tool": "Excel", "after_index": 0}})).json()["effective"]
        manual = [s for s in eff["steps"] if s["source"] == "manual"]
        assert len(manual) == 1 and manual[0]["action"] == "Reconcile returns"
        # base table still has exactly the 3 claim-derived steps
        assert await db.fetchval("select count(*) from workflow_steps where workflow_id=$1", wid) == 3

        # soft_hide is reversible: hidden step is still present (with a flag), unhide restores
        eff = (await c.post(f"/api/workflows/{wid}/edit",
                            json={"op": "soft_hide", "step_id": s1})).json()["effective"]
        assert next(s for s in eff["steps"] if s["step_id"] == s1)["hidden"] is True
        eff = (await c.post(f"/api/workflows/{wid}/edit",
                            json={"op": "unhide", "step_id": s1})).json()["effective"]
        assert next(s for s in eff["steps"] if s["step_id"] == s1)["hidden"] is False

        # history records every op (audit trail, who/when/what)
        hist = (await c.get(f"/api/workflows/{wid}/history")).json()
        assert [h["op"] for h in hist][::-1] == ["add_manual", "soft_hide", "unhide"]


async def test_blueprint_is_non_executable_with_all_slots(db):
    ws = await make_workspace(db, is_demo=True)
    sid = await make_session(db, ws)
    wid = await _workflow(db, ws, sid)
    async with _client() as c:
        bp = (await c.get(f"/api/workflows/{wid}/blueprint")).json()
    assert bp["executable"] is False
    slots = bp["steps"][0]["slots"]
    assert set(slots) == {"task", "trigger", "steps", "decision_rules", "exceptions",
                          "tools_systems", "output_format", "success_criteria", "examples",
                          "action_boundary"}
    assert slots["task"] and slots["action_boundary"] is None  # emitted slot filled; unemitted preserved empty


async def test_sop_folds_edits_and_excludes_hidden(db, monkeypatch):
    ws = await make_workspace(db, is_demo=True, industry="jewelry")
    sid = await make_session(db, ws)
    wid = await _workflow(db, ws, sid)

    seen = {}

    async def fake_agent(agent_name, user_content, **kw):
        assert agent_name == "report_sop_generator"
        seen["content"] = user_content
        return json.dumps({"title": "Repricing SOP", "overview": "how it runs",
                           "steps": [{"n": 1, "name": "Reprice", "instructions": "do it",
                                      "tool": "Excel", "note": None}], "follow_ups": []})

    monkeypatch.setattr(workflow_edit, "run_agent", fake_agent)

    async with _client() as c:
        eff = (await c.get(f"/api/workflows/{wid}/effective")).json()
        hide_id = eff["steps"][2]["step_id"]
        await c.post(f"/api/workflows/{wid}/edit", json={"op": "soft_hide", "step_id": hide_id})

    await workflow_edit.generate_sop({"workflow_id": wid})
    # the hidden step's action must not be handed to the SOP generator
    assert "Publish updates" not in seen["content"]
    doc = await db.fetchval("select document from workflow_sops where workflow_id=$1", wid)
    doc = json.loads(doc) if isinstance(doc, str) else doc
    assert doc["title"] == "Repricing SOP"
