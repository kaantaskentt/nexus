"""Sealed-flag disclosure screen (Emre stage-7 §7, A24). The screen agent is mocked;
these assert the DATA-LAYER invariants deterministically: flags land in sealed_flags
only, never in claim_records; the screen is idempotent; malformed screen output fails
loud; and session completion enqueues the screen beside the compile."""

import json

import pytest

from app.pipeline import disclosure
from tests.conftest import make_session, make_workspace


def _mock_agent(flags):
    async def _run(*_a, **_k):
        return "```json\n" + json.dumps(flags) + "\n```"

    return _run


async def _seed_utterances(pool, session_id, lines):
    for i, (spk, txt) in enumerate(lines):
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) "
            "values ($1,$2,$3,$4)",
            session_id, i, spk, txt,
        )


TIER2 = [{
    "tier": 2,
    "category": "safety",
    "reviewer_summary": "Respondent stated safety incidents go unreported at the warehouse.",
    "turn_refs": [2],
}]


async def test_flags_land_sealed_never_in_records(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [
        ("agent", "Walk me through the loading dock routine."),
        ("respondent", "It's fine mostly."),
        ("respondent", "Honestly we don't exactly report all the accidents out there."),
    ])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})

    rows = await db.fetch("select * from sealed_flags where session_id = $1", sess)
    assert len(rows) == 1
    assert rows[0]["tier"] == 2 and rows[0]["category"] == "safety"
    assert rows[0]["status"] == "unreviewed"
    # The whole point: nothing crossed into the record store.
    n_records = await db.fetchval(
        "select count(*) from claim_records where session_id = $1", sess
    )
    assert n_records == 0


async def test_flag_mints_minimized_incident_amber(db, monkeypatch):
    """A tier-2 flag mints exactly one harm_incidents row: category + amber bucket +
    session_ref, linked to the sealed_flag, notify pending. The record is MINIMIZED —
    the table has no verbatim/summary/turn_refs column at all (§7.6)."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "we don't report the accidents")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})

    rows = await db.fetch("select * from harm_incidents where session_id = $1", sess)
    assert len(rows) == 1
    inc = rows[0]
    assert inc["category"] == "safety" and inc["bucket"] == "amber"
    assert inc["notify_status"] == "pending" and inc["notified_at"] is None
    flag_id = await db.fetchval("select id from sealed_flags where session_id = $1", sess)
    assert inc["sealed_flag_id"] == flag_id
    # Schema-enforced minimization: no column can hold verbatim disclosure content.
    cols = {r["column_name"] for r in await db.fetch(
        "select column_name from information_schema.columns where table_name = 'harm_incidents'")}
    assert not (cols & {"reviewer_summary", "text", "turn_refs", "verbatim", "detail"})


async def test_tier3_incident_is_red_bucket(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "I don't want to be here anymore")])
    tier3 = [{"tier": 3, "category": "imminent_harm",
              "reviewer_summary": "Respondent expressed self-harm intent.", "turn_refs": [0]}]
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(tier3))
    await disclosure.screen_session({"session_id": str(sess)})
    bucket = await db.fetchval("select bucket from harm_incidents where session_id = $1", sess)
    assert bucket == "red"


async def test_incident_idempotent_no_duplicate(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "we don't report the accidents")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})
    await disclosure.screen_session({"session_id": str(sess)})  # re-complete path
    assert await db.fetchval("select count(*) from harm_incidents where session_id = $1", sess) == 1


async def test_incident_never_crosses_into_records(db, monkeypatch):
    """The whole point: a harm disclosure produces an incident + sealed flag and NOTHING
    in the record store — it can never become captured process (§7.6)."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "we don't report the accidents")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})
    assert await db.fetchval("select count(*) from harm_incidents where session_id = $1", sess) == 1
    assert await db.fetchval("select count(*) from claim_records where session_id = $1", sess) == 0


async def test_incident_survives_interview_delete(db, monkeypatch):
    """An admin deleting the interview must not scrub the safety layer: the incident is
    RETAINED with session_id nulled (FK on delete set null), and the cascade does not
    crash on the new table."""
    from app.pipeline.deletion import delete_interview

    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await db.execute("update interview_sessions set session_kind='interview' where id=$1", sess)
    await _seed_utterances(db, sess, [("respondent", "we don't report the accidents")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})

    result = await delete_interview(str(sess))
    assert result["deletable"] is True
    # Incident survives, session ref nulled — same doctrine as sealed_flags.
    surviving = await db.fetch("select session_id from harm_incidents where workspace_id = $1", ws)
    assert len(surviving) == 1 and surviving[0]["session_id"] is None


async def test_screen_idempotent_no_duplicate_flags(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "we don't report the accidents")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent(TIER2))
    await disclosure.screen_session({"session_id": str(sess)})
    await disclosure.screen_session({"session_id": str(sess)})  # re-complete path
    assert await db.fetchval("select count(*) from sealed_flags where session_id = $1", sess) == 1


async def test_clean_transcript_writes_nothing(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "I price the items and go home.")])
    monkeypatch.setattr(disclosure, "run_agent", _mock_agent([]))
    await disclosure.screen_session({"session_id": str(sess)})
    assert await db.fetchval("select count(*) from sealed_flags where session_id = $1", sess) == 0


async def test_malformed_screen_output_fails_loud(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "hello")])

    async def _bad(*_a, **_k):
        return "I could not really decide."

    monkeypatch.setattr(disclosure, "run_agent", _bad)
    with pytest.raises(Exception):
        await disclosure.screen_session({"session_id": str(sess)})


def test_parse_validates_tier_and_category():
    with pytest.raises(ValueError):
        disclosure.parse_screen_output(json.dumps([{"tier": 1, "category": "safety", "reviewer_summary": "x"}]))
    with pytest.raises(ValueError):
        disclosure.parse_screen_output(json.dumps([{"tier": 2, "category": "gossip", "reviewer_summary": "x"}]))
    with pytest.raises(ValueError):
        disclosure.parse_screen_output(json.dumps([{"tier": 2, "category": "safety"}]))
    assert disclosure.parse_screen_output("[]") == []


async def test_complete_enqueues_screen_beside_compile(db):
    """/complete queues BOTH compile_session and screen_disclosures — the screen must
    never depend on the compile succeeding."""
    from app.routers.sessions import complete

    ws = await make_workspace(db)
    sess = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, invite_token, status) "
        "values ($1, 'text', 'scrn-tok-1', 'active') returning id", ws)
    result = await complete("scrn-tok-1")
    assert result["status"] == "completed"
    kinds = {
        r["kind"] for r in await db.fetch(
            "select kind from jobs where payload->>'session_id' = $1", str(sess)
        )
    }
    assert {"compile_session", "screen_disclosures"} <= kinds
