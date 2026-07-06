"""Phase 6 — conflict/perception-gap engine, workflow schema, quality, report endpoint.
LLM calls are mocked; these assert the persistence + aggregation, and the F21 policy."""

import json

from app.pipeline import conflicts, quality, workflow
from app.pipeline.conflicts import precedence_lean
from app.routers.reports import report
from tests.conftest import make_session, make_workspace


def _agent_mock(by_agent: dict):
    async def _run(agent_name, content, **kw):
        return by_agent.get(agent_name, "[]")
    return _run


async def _claim(pool, ws, session_id, text, **over):
    cols = dict(kind="statement", topic="process_step", tag="CLAIMED", evidence_quote=None)
    cols.update(over)
    return await pool.fetchval(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, evidence_quote)
           values ($1,$2,$3,$4,$5,$6,$7) returning id""",
        ws, session_id, cols["kind"], cols["topic"], cols["tag"], text, cols["evidence_quote"],
    )


def test_precedence_lean_provisional():
    a = {"id": "a", "tag": "CONFIRMED"}
    b = {"id": "b", "tag": "CLAIMED"}
    assert precedence_lean(a, b)["favored_record"] == "a"   # episodic/confirmed wins
    assert precedence_lean(b, a)["favored_record"] == "a"
    assert precedence_lean({"id": "a", "tag": "CLAIMED"}, {"id": "b", "tag": "CLAIMED"}) is None


async def test_detect_conflicts_links_both_records(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    a = await _claim(db, ws, sess, "Returns take 40 minutes", topic="time_or_cost", tag="CLAIMED")
    b = await _claim(db, ws, sess, "Returns take two hours", topic="time_or_cost", tag="CONFIRMED")

    collision = json.dumps([{"record_a": str(a), "record_b": str(b), "axis": "time-or-cost",
                             "why": "40 min vs 2 hours", "kind": "ceo-vs-floor"}])
    monkeypatch.setattr(conflicts, "run_agent", _agent_mock({"collision_detector": collision}))
    await conflicts.detect_conflicts({"workspace_id": str(ws)})

    row = await db.fetchrow("select * from claim_conflicts where workspace_id=$1", ws)
    assert row is not None
    assert row["kind"] == "ceo_vs_floor"
    assert row["status"] == "disputed"
    # both records survive untouched
    assert await db.fetchval("select count(*) from claim_records where id in ($1,$2)", a, b) == 2
    res = json.loads(row["resolution"]) if isinstance(row["resolution"], str) else row["resolution"]
    assert res["lean"]["favored_record"] == str(b)  # CONFIRMED operator account leans


async def test_perception_gap_requires_two_sources(db, monkeypatch):
    """A perception gap is exec-belief vs floor-reality — same-speaker records must NOT
    become a gap (guards the comparator over-generating within a single interview)."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    burak = await db.fetchval(
        "insert into entities (workspace_id,entity_type,canonical_name,role) "
        "values ($1,'person','Burak','Operations') returning id", ws)
    a = await db.fetchval(
        "insert into claim_records (workspace_id,session_id,speaker_id,kind,topic,tag,claim_text) "
        "values ($1,$2,$3,'statement','time_or_cost','CLAIMED','Returns take 40 minutes') returning id",
        ws, sess, burak)
    b = await db.fetchval(
        "insert into claim_records (workspace_id,session_id,speaker_id,kind,topic,tag,claim_text) "
        "values ($1,$2,$3,'correction','time_or_cost','CONFIRMED','Returns take 10 minutes') returning id",
        ws, sess, burak)
    gap = json.dumps([{"baseline_record": str(a), "lived_record": str(b), "axis": "time-or-cost",
                      "gap": "believed 40; lived 10", "magnitude": "4x"}])
    monkeypatch.setattr(conflicts, "run_agent", _agent_mock({"perception_gap": gap}))
    await conflicts.detect_conflicts({"workspace_id": str(ws)})

    assert await db.fetchval(
        "select count(*) from claim_conflicts where kind='perception_gap' and workspace_id=$1", ws) == 0


async def test_build_workflow_schema_inserts_steps(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    c1 = await _claim(db, ws, sess, "Check the piece", topic="process_step")
    schema = json.dumps({"name": "Returns", "steps": [
        {"action": "Check the piece", "tool": "label printer", "input": "returned item",
         "output": "logged return", "verified": "partial",
         "spine_slots": {"task": "process a return"}, "slot_scores": {"steps": 1},
         "claim_ids": [str(c1)]}]})
    monkeypatch.setattr(workflow, "run_agent", _agent_mock({"report_sop_generator": schema}))
    await workflow.build_workflow_schema({"session_id": str(sess)})

    wf = await db.fetchrow("select * from workflows where session_id=$1", sess)
    assert wf["name"] == "Returns"
    step = await db.fetchrow("select * from workflow_steps where workflow_id=$1", wf["id"])
    assert step["action"] == "Check the piece"
    assert step["verified"] == "partial"
    assert [str(c) for c in step["claim_ids"]] == [str(c1)]


async def test_quality_writes_resumable_state(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    await db.execute("insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'agent','hi')", sess)
    await db.execute("insert into utterances (session_id,turn_index,speaker,text) values ($1,1,'respondent','we check then refund')", sess)
    result = json.dumps({"objectives": [{"id": "o1", "outcome": "partial", "note": "general"}],
                         "headline": "1 partial to follow up", "follow_ups": ["ask for an episode"]})
    monkeypatch.setattr(quality, "run_agent", _agent_mock({"interview_quality": result}))
    await quality.score_interview_quality({"session_id": str(sess)})

    state = await db.fetchval("select resumable_state from interview_sessions where id=$1", sess)
    state = json.loads(state) if isinstance(state, str) else state
    assert state["interview_quality"]["headline"] == "1 partial to follow up"


async def test_report_endpoint_shape(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    pain = await _claim(db, ws, sess, "Returns pile up every morning", topic="pain", tag="CONFIRMED",
                        evidence_quote="it's a nightmare")
    await db.execute(
        "insert into pain_scores (claim_id, band, rationale, rater_version) values ($1,'high','x','v1')", pain)
    await _claim(db, ws, sess, "I don't know how the label printer is configured", kind="admission", tag=None)
    a = await _claim(db, ws, sess, "40 minutes", topic="time_or_cost", tag="CLAIMED")
    b = await _claim(db, ws, sess, "two hours", topic="time_or_cost", tag="CONFIRMED")
    await db.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1,$2,$3,'perception_gap',$4)""",
        ws, a, b, json.dumps({"gap": "leadership believes 40m; floor lives 2h", "render": "report-only"}))

    result = await report(str(sess))
    assert result["session_id"] == str(sess)
    assert len(result["perception_gaps"]) == 1
    assert result["perception_gaps"][0]["claim_a"]["text"] == "40 minutes"
    assert any(f["pain_band"] == "high" for f in result["key_findings"])
    assert any(f["kind"] == "admission" for f in result["follow_up_on"])
