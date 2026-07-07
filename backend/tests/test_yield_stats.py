"""Question yield stats (Emre stage-7 §10, A24). The attribution core is pure and
deterministic — verbatim evidence_quote -> respondent turn -> nearest preceding agent
question — so these tests pin it without any model. The coverage audit is fail-open
and mocked."""

import json

from app.pipeline import yield_stats
from tests.conftest import make_session, make_workspace

UTTS = [
    {"turn_index": 0, "speaker": "agent", "text": "Walk me through the morning."},
    {"turn_index": 1, "speaker": "respondent", "text": "First I reprice the gold items, takes about an hour."},
    {"turn_index": 2, "speaker": "agent", "text": "What happens when it goes wrong?"},
    {"turn_index": 3, "speaker": "respondent", "text": "Last Tuesday the price feed was stale and we sold at Monday's rate."},
    {"turn_index": 4, "speaker": "agent", "text": "Anything else I should have asked?"},
    {"turn_index": 5, "speaker": "respondent", "text": "Not really."},
]


def test_records_credit_the_preceding_question():
    records = [
        {"evidence_quote": "First I reprice the gold items"},
        {"evidence_quote": "the price feed was stale"},
        {"evidence_quote": "sold at Monday's rate"},
    ]
    out = yield_stats.compute_yield(UTTS, records)
    by_turn = {q["turn_index"]: q for q in out["questions"]}
    assert by_turn[0]["records"] == 1
    assert by_turn[2]["records"] == 2
    assert by_turn[4]["records"] == 0
    assert out["zero_yield_questions"] == 1
    assert out["unattributed_records"] == 0
    assert out["total_records"] == 3


def test_unmatched_quote_counts_unattributed_never_guessed():
    records = [{"evidence_quote": "a paraphrase that appears nowhere"}]
    out = yield_stats.compute_yield(UTTS, records)
    assert out["unattributed_records"] == 1
    assert all(q["records"] == 0 for q in out["questions"])


def test_match_is_case_and_whitespace_insensitive():
    records = [{"evidence_quote": "  THE PRICE   FEED was STALE "}]
    out = yield_stats.compute_yield(UTTS, records)
    by_turn = {q["turn_index"]: q for q in out["questions"]}
    assert by_turn[2]["records"] == 1


async def test_job_persists_yield_stats_and_survives_coverage_failure(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    for u in UTTS:
        await db.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,$3,$4)",
            sess, u["turn_index"], u["speaker"], u["text"],
        )
    await db.execute(
        """insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, evidence_quote)
           values ($1, $2, 'statement', 'process_step', 'CLAIMED', 'Repricing happens first.', 'First I reprice the gold items')""",
        ws, sess,
    )

    async def _boom(*_a, **_k):
        raise RuntimeError("coverage seat down")

    monkeypatch.setattr(yield_stats.coverage_mod, "compute_coverage", _boom)
    await yield_stats.compute_session_yield({"session_id": str(sess)})

    raw = await db.fetchval("select yield_stats from interview_sessions where id = $1", sess)
    stats = json.loads(raw) if isinstance(raw, str) else raw
    assert stats["total_records"] == 1
    assert stats["questions"][0]["records"] == 1
    assert stats["coverage"] is None  # fail-open: audit lost, yield landed
    assert stats["computed_at"]
