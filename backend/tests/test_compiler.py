"""Compiler persistence tests. The agent is mocked with a fixed structured output so
these assert the ONTOLOGY invariants deterministically (no live model, no flakiness):
corrections supersede without editing, entities mint client-side, sentiment locks."""

import json

import pytest

from app.pipeline import compiler, entities
from tests.conftest import make_session, make_workspace


def _mock_agent(output: dict):
    async def _run(*_a, **_k):
        return "```json\n" + json.dumps(output) + "\n```"

    return _run


async def _no_embed(_text):
    return None


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    monkeypatch.setattr(compiler, "embed", _no_embed)


async def _seed_utterances(pool, session_id, lines):
    for i, (spk, txt) in enumerate(lines):
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) "
            "values ($1,$2,$3,$4)",
            session_id,
            i,
            spk,
            txt,
        )


async def test_correction_supersedes_original_untouched(db, monkeypatch):
    """Canonical regression: '40 minutes' corrected to '10 minutes' produces a
    correction record superseding the original; the original is never edited."""
    ws = await make_workspace(db, industry="jewelry")
    interviewee = await entities.resolve_or_create(ws, "Ece")
    sess = await make_session(db, ws, interviewee_id=interviewee[0])
    await _seed_utterances(
        db,
        sess,
        [
            ("respondent", "Packing an order takes about 40 minutes."),
            ("agent", "Got it."),
            ("respondent", "Sorry — 10 minutes. I was thinking of something else."),
        ],
    )

    output = {
        "records": [
            {
                "id": "r1",
                "kind": "statement",
                "topic": "time-or-cost",
                "tag": "claimed",
                "claim": "Packing an order takes 40 minutes",
                "evidence": {"quote": "takes about 40 minutes", "timestamp": "#0", "speaker": "Ece"},
                "speaker_name": "Ece",
                "supersedes": None,
            },
            {
                "id": "r2",
                "kind": "correction",
                "topic": "time-or-cost",
                "tag": "claimed",
                "claim": "Packing an order takes 10 minutes",
                "evidence": {"quote": "Sorry — 10 minutes", "timestamp": "#2", "speaker": "Ece"},
                "speaker_name": "Ece",
                "supersedes": "r1",
            },
        ],
        "mentions": [],
    }
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(output))
    await compiler.compile_session({"session_id": str(sess)})

    rows = await db.fetch(
        "select * from claim_records where workspace_id = $1 order by created_at", ws
    )
    assert len(rows) == 2
    original = next(r for r in rows if "40 minutes" in r["claim_text"])
    correction = next(r for r in rows if r["kind"] == "correction")

    assert correction["supersedes_id"] == original["id"]
    # original untouched
    assert original["tag"] == "CLAIMED"
    assert original["supersedes_id"] is None
    assert original["quarantined"] is False
    assert "40 minutes" in original["claim_text"]


async def test_fact_and_judgment_split_judgment_quarantined(db, monkeypatch):
    """One utterance carrying a fact + a person-judgment lands as two records; the
    judgment is quarantined and excluded from client_visible_claims."""
    ws = await make_workspace(db)
    interviewee = await entities.resolve_or_create(ws, "Ece")
    sess = await make_session(db, ws, interviewee_id=interviewee[0])
    await _seed_utterances(db, sess, [("respondent", "Burak does the repricing; he's a bit slow though.")])

    output = {
        "records": [
            {
                "id": "r1",
                "kind": "statement",
                "topic": "person",
                "tag": "claimed",
                "claim": "Burak owns the daily repricing",
                "evidence": {"quote": "Burak does the repricing", "timestamp": "#0", "speaker": "Ece"},
                "speaker_name": "Ece",
                "subject_name": "Burak",
                "flags": {"sentiment_quarantine": False},
            },
            {
                "id": "r2",
                "kind": "statement",
                "topic": "person",
                "tag": "claimed",
                "claim": "Ece considers Burak slow",
                "evidence": {"quote": "he's a bit slow", "timestamp": "#0", "speaker": "Ece"},
                "speaker_name": "Ece",
                "subject_name": "Burak",
                "flags": {"sentiment_quarantine": True},
            },
        ],
        "mentions": [],
    }
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(output))
    await compiler.compile_session({"session_id": str(sess)})

    fact = await db.fetchrow(
        "select * from claim_records where claim_text like 'Burak owns%'"
    )
    judgment = await db.fetchrow(
        "select * from claim_records where claim_text like 'Ece considers%'"
    )
    assert fact["quarantined"] is False
    assert judgment["quarantined"] is True and judgment["sentiment_flag"] is True

    visible_ids = {
        r["id"] for r in await db.fetch("select id from client_visible_claims where workspace_id=$1", ws)
    }
    assert fact["id"] in visible_ids
    assert judgment["id"] not in visible_ids


async def test_new_person_minted_client_side(db, monkeypatch):
    """A call-mentioned name absent from the pool mints a NEW-PERSON entity that is
    always client-side — a transcript can never create a vendor entity."""
    ws = await make_workspace(db)
    interviewee = await entities.resolve_or_create(ws, "Ece")
    sess = await make_session(db, ws, interviewee_id=interviewee[0])
    await _seed_utterances(db, sess, [("respondent", "Selin handles all the online returns.")])

    output = {
        "records": [
            {
                "id": "r1",
                "kind": "statement",
                "topic": "person",
                "tag": "claimed",
                "claim": "Selin handles online returns",
                "evidence": {"quote": "Selin handles all the online returns", "timestamp": "#0", "speaker": "Ece"},
                "speaker_name": "Ece",
                "subject_name": "Selin",
            }
        ],
        "mentions": [],
    }
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(output))
    await compiler.compile_session({"session_id": str(sess)})

    selin = await db.fetchrow(
        "select * from entities where lower(canonical_name) = 'selin' and workspace_id = $1", ws
    )
    assert selin is not None
    assert selin["is_vendor_side"] is False
    assert selin["source"] == "interview"


async def _compile_confirmed_fact(db, monkeypatch, *, session_max_tag, payload_max_tag):
    """Compile one CONFIRMED-tagged fact and return the tag it persisted with, given a
    session compile_max_tag and/or a payload max_tag. Isolates the cap resolution."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    if session_max_tag is not None:
        await db.execute(
            "update interview_sessions set compile_max_tag = $1 where id = $2",
            session_max_tag, sess,
        )
    await _seed_utterances(db, sess, [("respondent", "We ship every order the same morning it comes in.")])
    output = {
        "records": [{
            "id": "r1", "kind": "statement", "topic": "process-step", "tag": "confirmed",
            "claim": "Orders ship the same morning",
            "evidence": {"quote": "ship every order the same morning", "timestamp": "#0", "speaker": "Ece"},
            "speaker_name": "Ece",
        }],
        "mentions": [],
    }
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(output))
    payload = {"session_id": str(sess)}
    if payload_max_tag is not None:
        payload["max_tag"] = payload_max_tag
    await compiler.compile_session(payload)
    return await db.fetchval("select tag from claim_records where workspace_id = $1", ws)


async def test_compile_caps_at_session_max_tag(db, monkeypatch):
    """ANYTIME-CONTEXT CLAIMED cap. Pins the compiler's max_tag resolution
    (payload.get('max_tag') or session['compile_max_tag']) at three points:
      1. a session cap of CLAIMED pulls a CONFIRMED fact down to CLAIMED (additive founder call);
      2. a null session leaves it CONFIRMED — byte-identical to today (first call / interviews);
      3. an explicit payload max_tag wins over the session column (intake still short-circuits)."""
    assert await _compile_confirmed_fact(db, monkeypatch, session_max_tag="CLAIMED", payload_max_tag=None) == "CLAIMED"
    assert await _compile_confirmed_fact(db, monkeypatch, session_max_tag=None, payload_max_tag=None) == "CONFIRMED"
    assert await _compile_confirmed_fact(db, monkeypatch, session_max_tag="CLAIMED", payload_max_tag="GUESS") == "GUESS"


async def test_directive_stores_with_null_tag(db, monkeypatch):
    """Directives are not on the trust ladder — they persist with a null tag."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await _seed_utterances(db, sess, [("respondent", "Don't mention anything to the Harrods people.")])

    output = {
        "records": [
            {
                "id": "r1",
                "kind": "directive",
                "topic": "person",
                "tag": None,
                "claim": "Do not mention the renegotiation to Harrods contacts",
                "evidence": {"quote": "Don't mention anything to the Harrods people", "timestamp": "#0", "speaker": "Ece"},
                "speaker_name": "Ece",
                "triggers": ["SEQUENCING: avoid Harrods topic"],
            }
        ],
        "mentions": [],
    }
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(output))
    await compiler.compile_session({"session_id": str(sess)})

    row = await db.fetchrow("select * from claim_records where kind = 'directive'")
    assert row is not None
    assert row["tag"] is None

    # The directive surfaces to the plan-generator path as a NEVER-list candidate,
    # carrying its SEQUENCING trigger — not just stored.
    from app.routers.claims import never_list_candidates

    candidates = await never_list_candidates(str(ws))
    assert len(candidates) == 1
    assert "Harrods" in candidates[0]["instruction"]
    assert any("SEQUENCING" in t for t in candidates[0]["triggers"])


async def test_compile_session_is_idempotent_on_existing_records(db, monkeypatch):
    """WS-6 prevention: a session that already produced records never compiles again
    (retry storms / double-enqueues re-inserted whole record sets during the July 10
    outage). force=true stays available for a deliberate recompile."""
    from tests.conftest import make_workspace
    from app.pipeline.compiler import compile_session

    ws = await make_workspace(db, industry="jewelry")
    sid = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind) "
        "values ($1, 'text', 'completed', 'context') returning id", ws)
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) "
        "values ($1, 0, 'respondent', 'we clean data every morning')", sid)
    await db.execute(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1, $2, 'statement', 'process_step', 'CLAIMED', 'existing record', false)",
        ws, sid)

    called = {"n": 0}

    async def _agent(*a, **k):
        called["n"] += 1
        return '{"records": [], "mentions": []}'

    monkeypatch.setattr("app.pipeline.compiler.run_agent", _agent)
    await compile_session({"session_id": str(sid)})
    assert called["n"] == 0  # skipped before any model call
    assert await db.fetchval(
        "select count(*) from claim_records where session_id=$1", sid) == 1

    await compile_session({"session_id": str(sid), "force": True})
    assert called["n"] == 1  # deliberate recompile still possible
