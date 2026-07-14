"""Deep Research Knowledge Base — Definition of Done, chunking/source discipline, case
reuse, and the is_demo firewall are all enforced in code (PRD-DEEP-RESEARCH-KB.md §5b,
§5c, §9), never trusted to the agent's own say-so. These tests never touch the live LLM
or web search — they monkeypatch the tool-calling seam, same pattern as test_handoff.py's
`run_agent` mock."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import deep_research as dr
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


def _finding(section, body="A specific, grounded operational claim about this vertical.",
             url="https://example.com/a", title="t"):
    return {"section": section, "title": title, "body": body, "source_url": url}


FULL_DOD_FINDINGS = [
    _finding("process_areas"), _finding("process_areas"),
    _finding("tools_systems"), _finding("tools_systems"),
    _finding("roles_org"),
    _finding("failure_modes"), _finding("failure_modes"),
    _finding("definition_of_done"),
]
SEEN_URLS = {"https://example.com/a"}


def _mock_agent(findings, urls_seen, any_tool_used=True):
    async def _fake(workspace_id, industry, business_model, scale_band):
        return findings, urls_seen, any_tool_used
    return _fake


async def test_dod_met_creates_case_and_stores_findings(db, monkeypatch):
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(FULL_DOD_FINDINGS, SEEN_URLS))
    ws = await make_workspace(db, industry="jewelry")

    result = await dr.run_deep_research(ws)

    assert result["dod_met"] is True
    assert result["reused"] is False
    assert result["findings"] == len(FULL_DOD_FINDINGS)

    case = await db.fetchrow("select * from research_cases where id = $1", result["case_id"])
    assert case["dod_met"] is True
    assert case["status"] == "draft"
    assert case["industry"] == "jewelry"

    findings = await db.fetch("select * from research_findings where case_id = $1", result["case_id"])
    assert len(findings) == len(FULL_DOD_FINDINGS)
    assert all(f["source_url"] for f in findings)

    link = await db.fetchrow(
        "select * from workspace_research_links where workspace_id = $1", ws
    )
    assert link["relation"] == "own"


async def test_dod_not_met_when_a_must_hit_section_is_thin(db, monkeypatch):
    thin = [_finding("process_areas")]  # only 1 of 2 required, other sections empty
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(thin, SEEN_URLS))
    ws = await make_workspace(db, industry="hospitality")

    result = await dr.run_deep_research(ws)

    assert result["dod_met"] is False
    case = await db.fetchrow("select * from research_cases where id = $1", result["case_id"])
    assert case["dod_met"] is False
    assert case["generation_attempts"] == 1
    # Still saved and still linked — fail-open, never blocks the workspace.
    assert await db.fetchval(
        "select count(*) from workspace_research_links where workspace_id = $1", ws
    ) == 1


async def test_finding_dropped_when_source_url_not_grounded(db, monkeypatch):
    findings = FULL_DOD_FINDINGS + [_finding("kpis_benchmarks", url="https://invented-source.example/x")]
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(findings, SEEN_URLS))
    ws = await make_workspace(db, industry="agency")

    result = await dr.run_deep_research(ws)

    # The fabricated-source finding must never reach the DB, even though the rest pass.
    assert result["findings"] == len(FULL_DOD_FINDINGS)
    kpi_rows = await db.fetch(
        "select * from research_findings where case_id = $1 and section = 'kpis_benchmarks'",
        result["case_id"],
    )
    assert kpi_rows == []


async def test_finding_dropped_when_no_source_url_or_too_short(db, monkeypatch):
    bad = FULL_DOD_FINDINGS + [
        {"section": "vocabulary", "title": "t", "body": "too short", "source_url": "https://example.com/a"},
        {"section": "vocabulary", "title": "t", "body": "A perfectly long enough finding body here.", "source_url": ""},
    ]
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(bad, SEEN_URLS))
    ws = await make_workspace(db, industry="accounting")

    result = await dr.run_deep_research(ws)

    assert result["findings"] == len(FULL_DOD_FINDINGS)  # both bad vocabulary rows dropped


async def test_dod_not_met_when_no_tool_actually_ran(db, monkeypatch):
    """A recall dump with zero real tool calls must never pass as grounded research."""
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(FULL_DOD_FINDINGS, SEEN_URLS, any_tool_used=False))
    ws = await make_workspace(db, industry="jewelry")

    result = await dr.run_deep_research(ws)

    assert result["dod_met"] is False


async def test_case_reused_across_workspaces_same_fingerprint(db, monkeypatch):
    calls = {"n": 0}

    async def _fake(workspace_id, industry, business_model, scale_band):
        calls["n"] += 1
        return FULL_DOD_FINDINGS, SEEN_URLS, True

    monkeypatch.setattr(dr, "_run_research_agent", _fake)

    ws1 = await make_workspace(db, industry="jewelry")
    r1 = await dr.run_deep_research(ws1)
    assert r1["reused"] is False
    assert calls["n"] == 1

    ws2 = await make_workspace(db, industry="jewelry")
    r2 = await dr.run_deep_research(ws2)

    assert r2["case_id"] == r1["case_id"]
    assert r2["reused"] is True
    assert calls["n"] == 1  # never re-researched — this IS the compounding PRD §3 wants

    both_linked = await db.fetch(
        "select workspace_id from workspace_research_links where case_id = $1", r1["case_id"]
    )
    assert {str(r["workspace_id"]) for r in both_linked} == {str(ws1), str(ws2)}


async def test_demo_and_real_workspaces_never_share_a_case(db, monkeypatch):
    """A12 firewall: same industry, one demo one real, must resolve to DIFFERENT cases."""
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(FULL_DOD_FINDINGS, SEEN_URLS))

    ws_real = await make_workspace(db, industry="jewelry", is_demo=False)
    ws_demo = await make_workspace(db, industry="jewelry", is_demo=True)

    r_real = await dr.run_deep_research(ws_real)
    r_demo = await dr.run_deep_research(ws_demo)

    assert r_real["case_id"] != r_demo["case_id"]
    case_real = await db.fetchrow("select is_demo from research_cases where id = $1", r_real["case_id"])
    case_demo = await db.fetchrow("select is_demo from research_cases where id = $1", r_demo["case_id"])
    assert case_real["is_demo"] is False
    assert case_demo["is_demo"] is True


async def test_generation_attempts_capped_and_stops_reresearching(db, monkeypatch):
    calls = {"n": 0}

    async def _thin(workspace_id, industry, business_model, scale_band):
        calls["n"] += 1
        return [_finding("process_areas")], SEEN_URLS, True  # always thin, never meets DoD

    monkeypatch.setattr(dr, "_run_research_agent", _thin)

    ws = await make_workspace(db, industry="jewelry")
    await dr.run_deep_research(ws)   # attempt 1
    await dr.run_deep_research(ws)   # attempt 2 (still not met, hits the cap)
    await dr.run_deep_research(ws)   # would be attempt 3 — must be skipped by the cap

    assert calls["n"] == dr.MAX_GENERATION_ATTEMPTS


# ── Admin-button endpoints (workspaces.py: /research/regenerate + /research/status) ──

async def test_regenerate_endpoint_enqueues_a_job(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as client:
        resp = await client.post(f"/api/workspaces/{ws}/research/regenerate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["already_running"] is False
    job = await db.fetchrow("select kind, payload from jobs where id = $1", body["job_id"])
    assert job["kind"] == "deep_research"


async def test_regenerate_endpoint_reuses_an_in_flight_job_instead_of_racing_it(db):
    """The refresh-mid-run scenario: a queued/running deep_research job for this
    workspace must be handed back as-is, never duplicated — this is the server-side half
    of the fix; the frontend's own mount-time resume is the other half."""
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as client:
        first = await client.post(f"/api/workspaces/{ws}/research/regenerate")
        second = await client.post(f"/api/workspaces/{ws}/research/regenerate")

    assert first.json()["job_id"] == second.json()["job_id"]
    assert second.json()["already_running"] is True
    count = await db.fetchval(
        "select count(*) from jobs where kind = 'deep_research' and payload->>'workspace_id' = $1",
        str(ws),
    )
    assert count == 1


async def test_status_endpoint_reports_no_case_before_any_run(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as client:
        resp = await client.get(f"/api/workspaces/{ws}/research/status")
    assert resp.status_code == 200
    assert resp.json() == {"job_id": None, "job_status": None, "case": None}


async def test_status_endpoint_resolves_the_in_flight_job_without_a_job_id(db):
    """A page refresh mid-run has no job_id in local state — the status endpoint must
    resolve the workspace's own latest job on its own, or a refresh looks identical to
    "nothing ever started" and the button reappears mid-run."""
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as client:
        triggered = await client.post(f"/api/workspaces/{ws}/research/regenerate")
        status = await client.get(f"/api/workspaces/{ws}/research/status")

    body = status.json()
    assert body["job_id"] == triggered.json()["job_id"]
    assert body["job_status"] == "queued"  # no worker draining it in this test


async def test_status_endpoint_reports_the_linked_case_after_a_run(db, monkeypatch):
    monkeypatch.setattr(dr, "_run_research_agent", _mock_agent(FULL_DOD_FINDINGS, SEEN_URLS))
    ws = await make_workspace(db, industry="jewelry")
    result = await dr.run_deep_research(ws)

    async with _client() as client:
        resp = await client.get(f"/api/workspaces/{ws}/research/status")

    body = resp.json()
    assert body["case"]["id"] == result["case_id"]
    assert body["case"]["dod_met"] is True
    assert body["case"]["findings"] == len(FULL_DOD_FINDINGS)
