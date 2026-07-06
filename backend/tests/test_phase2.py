"""Phase 2 — Stage 1 recon (SCRAPED records + client people pool) and Stage 2
heuristics (falsifiable generation + F13-credited scoring). LLM + HTTP mocked; the
demo/fixtures path never live-scrapes (A11.3)."""

import json

from app.pipeline import heuristics, recon
from tests.conftest import make_session, make_workspace


def _agent(output: str):
    async def _run(agent_name, content, **kw):
        return output
    return _run


async def test_recon_fixtures_scraped_records_and_client_pool(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    structured = json.dumps({
        "company_records": [
            {"topic": "company-fact", "claim": "Operates twelve boutiques", "source_url": "http://x",
             "quote": "12 boutiques", "staleness_risk": "high"},
            {"topic": "vocabulary", "claim": "Uses the term 'yıldırım'", "quote": "yıldırım", "staleness_risk": "low"},
        ],
        "people_pool": [
            {"person": "Derya Aksoy", "role_title": "Founder", "side": "client", "confidence": "high", "aliases": []},
            {"person": "Some Agency Rep", "role_title": "Account Manager", "side": "non-client", "confidence": "low"},
        ],
    })
    monkeypatch.setattr("app.llm.run_agent", _agent(structured))
    await recon.run_recon({"workspace_id": str(ws), "fixtures": {
        "website_markdown": "We have 12 boutiques and rush 'yıldırım' orders.",
        "linkedin_people": [{"name": "Derya Aksoy"}],
    }})

    scraped = await db.fetch("select * from claim_records where workspace_id=$1 and tag='SCRAPED'", ws)
    assert len(scraped) == 2
    # time-sensitive fact flagged stale
    boutiques = next(r for r in scraped if "boutiques" in r["claim_text"])
    prov = json.loads(boutiques["provenance"]) if isinstance(boutiques["provenance"], str) else boutiques["provenance"]
    assert prov["staleness_risk"] == "high"

    # client person entered the pool; the agency rep did NOT (vendor/non-client firewall)
    derya = await db.fetchrow("select * from entities where canonical_name='Derya Aksoy' and workspace_id=$1", ws)
    assert derya is not None and derya["is_vendor_side"] is False and derya["source"] == "scraped"
    assert await db.fetchval("select count(*) from entities where canonical_name='Some Agency Rep'") == 0

    # Stage 2 generation was chained.
    assert await db.fetchval(
        "select count(*) from jobs where kind='generate_heuristics' and payload->>'workspace_id'=$1", str(ws)) == 1


async def test_generate_heuristics_from_scraped(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text) "
        "values ($1,'statement','company_fact','SCRAPED','Repricing likely manual')", ws)
    out = json.dumps([{"heuristic": "Repricing is a manual single-person spreadsheet task",
                      "predicts": ["named owner", "manual tool"], "topic": "tool",
                      "prior_confidence": "low", "verification_objective": "who reprices and how"}])
    monkeypatch.setattr("app.llm.run_agent", _agent(out))
    await heuristics.generate_heuristics({"workspace_id": str(ws)})

    row = await db.fetchrow("select * from heuristics where workspace_id=$1", ws)
    assert row["status"] == "open"
    assert "manual" in row["text"]
    assert row["falsifiable_as"]  # not null


async def test_score_heuristics_credits_unprompted(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    hid = await db.fetchval(
        "insert into heuristics (workspace_id, text, falsifiable_as) values ($1,'Repricing is manual','who/how') returning id", ws)
    rid = await db.fetchval(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text) "
        "values ($1,$2,'statement','tool','CLAIMED','Burak reprices in a personal Excel') returning id", ws, sess)
    out = json.dumps([{"heuristic_id": str(hid), "status": "confirmed",
                      "raised_unprompted": True, "evidence_record_ids": [str(rid)]}])
    monkeypatch.setattr("app.llm.run_agent", _agent(out))
    await heuristics.score_heuristics({"workspace_id": str(ws), "session_id": str(sess)})

    row = await db.fetchrow("select * from heuristics where id=$1", hid)
    assert row["status"] == "confirmed"
    assert row["raised_unprompted"] is True
    assert [str(c) for c in row["evidence_claim_ids"]] == [str(rid)]
    assert row["scored_at"] is not None
