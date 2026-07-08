"""Demo transcript generator (Kaan verdict 8): synthetic is a STRUCTURAL flag — the
'demo' session kind drives record-level provenance in the compiler, the founder is never
relabeled, and the real contact is never minted as the speaker of made-up claims."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import compiler
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _make_company():
    async with _client() as c:
        return (
            await c.post(
                "/api/workspaces",
                json={"name": "Bee Goddess", "industry": "jewelry", "contact_person": "Ece"},
            )
        ).json()


COMPILER_OUT = {
    "records": [{
        "id": "r1", "kind": "statement", "topic": "process-step", "tag": "claimed",
        "claim": "Repricing happens before the stores open.",
        "evidence": {"quote": "reprices before the stores open", "timestamp": "#1", "speaker": "CEO"},
        "speaker_name": "CEO", "subject_name": None, "hedges": [], "flags": {},
    }],
    "mentions": [],
}


def _mock_agent(output):
    async def _run(*_a, **_k):
        return "```json\n" + json.dumps(output) + "\n```"
    return _run


async def _no_embed(_t):
    return None


async def test_demo_upload_marks_kind_and_protects_identity(db):
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={"transcript": "CEO: Deniz reprices before the stores open, his own sheet.",
                  "session_kind": "demo"},
        )
    assert r.status_code == 200
    sess = r.json()["session_id"]
    row = await db.fetchrow(
        "select s.session_kind, e.canonical_name from interview_sessions s "
        "left join entities e on e.id = s.interviewee_id where s.id = $1::uuid", sess)
    assert row["session_kind"] == "demo"
    assert row["canonical_name"] == "Example CEO (synthetic)"  # never the real contact
    label = await db.fetchval(
        "select label from interview_rounds where workspace_id = $1::uuid "
        "order by created_at desc limit 1", ws["id"])
    assert label == "Example call (synthetic)"
    cfg = await db.fetchval("select config from workspaces where id = $1::uuid", ws["id"])
    cfg = json.loads(cfg) if isinstance(cfg, str) else (cfg or {})
    assert cfg.get("source") != "CEO Discovery Call"


async def test_demo_compile_flags_every_record_synthetic(db, monkeypatch):
    monkeypatch.setattr(compiler, "embed", _no_embed)
    monkeypatch.setattr(compiler, "run_agent", _mock_agent(COMPILER_OUT))
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={"transcript": "CEO: Deniz reprices before the stores open.",
                  "session_kind": "demo"},
        )
    sess = r.json()["session_id"]
    await compiler.compile_session({"session_id": sess})
    prov = await db.fetchval(
        "select provenance from claim_records where session_id = $1::uuid limit 1", sess)
    prov = json.loads(prov) if isinstance(prov, str) else prov
    assert prov.get("synthetic") is True

    # Control: a REAL interview upload compiles with no synthetic flag.
    async with _client() as c:
        r2 = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={"transcript": "Ece: Deniz reprices before the stores open.",
                  "speaker_name": "Ece"},
        )
    sess2 = r2.json()["session_id"]
    await compiler.compile_session({"session_id": sess2})
    prov2 = await db.fetchval(
        "select provenance from claim_records where session_id = $1::uuid limit 1", sess2)
    prov2 = json.loads(prov2) if isinstance(prov2, str) else prov2
    assert "synthetic" not in prov2


async def test_generate_route_returns_transcript(db, monkeypatch):
    from app.routers import workspaces as ws_router  # noqa: F401

    async def _fake_agent(agent_name, user_content, **kw):
        assert agent_name == "demo_transcript"
        assert "Bee Goddess" in user_content
        return "You: What do you actually do here?\nCEO: Honestly, mornings are the prices."

    import app.llm as llm_mod
    monkeypatch.setattr(llm_mod, "run_agent", _fake_agent)
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(f"/api/workspaces/{ws['id']}/demo-transcript")
    assert r.status_code == 200
    out = r.json()
    assert out["synthetic"] is True and out["session_kind"] == "demo"
    assert out["transcript"].startswith("You: ")
