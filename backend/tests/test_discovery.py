"""CEO discovery upload (A17 / #6): the transcript is stored verbatim, the STANDARD
compile job is enqueued (never a shortcut path), and the status endpoint reports honest
per-stage progress off the real jobs table."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline.compiler import _should_render_snapshot
from app.pipeline.transcript import parse_transcript


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


# ── render-snapshot guardrail (A3): CEO/discovery call only ───────────────────

def test_render_gate_requires_flag_and_plan_less_session():
    discovery = {"plan_id": None}
    employee = {"plan_id": "a-plan-uuid"}
    # discovery call with the flag -> render
    assert _should_render_snapshot(discovery, {"render_snapshot": True}) is True
    # employee interview NEVER auto-renders, even if the flag leaks in
    assert _should_render_snapshot(employee, {"render_snapshot": True}) is False
    # no flag -> never renders (normal interview compile path)
    assert _should_render_snapshot(discovery, {}) is False


async def _make_company(name="Bee Goddess", industry="jewelry", contact="Ece"):
    async with _client() as c:
        return (
            await c.post(
                "/api/workspaces",
                json={"name": name, "industry": industry, "contact_person": contact},
            )
        ).json()


# ── transcript parser (pure) ─────────────────────────────────────────────────

def test_parse_keeps_text_verbatim():
    text = "Ece: It takes him, sanırım, maybe two hours?\nInterviewer: And the Excel?"
    turns = parse_transcript(text)
    assert turns[0]["speaker"] == "respondent"
    # hedges + the non-English token survive untouched
    assert turns[0]["text"] == "It takes him, sanırım, maybe two hours?"
    assert turns[1]["speaker"] == "agent"  # "Interviewer" is an agent label
    assert turns[1]["text"] == "And the Excel?"


def test_parse_unlabeled_blob_is_one_respondent_turn():
    turns = parse_transcript("We closed Ankara last month. Twelve boutiques, well, ten now.")
    assert len(turns) == 1
    assert turns[0]["speaker"] == "respondent"


def test_parse_does_not_split_a_normal_colon_sentence():
    # A sentence with a mid-clause colon must not be mistaken for a "Speaker:" label —
    # the multi-word prefix has spaces, so the whole line stays verbatim.
    turns = parse_transcript("Here is the thing: returns eat the whole morning")
    assert turns[0]["text"] == "Here is the thing: returns eat the whole morning"
    assert turns[0]["speaker"] == "respondent"


def test_parse_preserves_the_harrods_line_verbatim():
    # From the demo transcript: "One thing:" is spoken content, not a speaker label.
    line = "One thing: don't mention anything to the Harrods people, we're renegotiating."
    turns = parse_transcript(line)
    assert turns[0]["text"] == line
    assert turns[0]["speaker"] == "respondent"


def test_parse_handles_a_long_label_like_prefix_without_regex_backtracking():
    line = "Speaker: " + (" " * 100_000)
    turns = parse_transcript(line)
    assert turns == [{"turn_index": 0, "speaker": "respondent", "text": "Speaker:"}]


# ── upload endpoint ──────────────────────────────────────────────────────────

async def test_upload_stores_verbatim_and_enqueues_standard_compile(db):
    ws = await _make_company()
    transcript = "Ece: Every morning Burak handles the repricing, has for years.\nInterviewer: How long?"
    async with _client() as c:
        r = await c.post(f"/api/workspaces/{ws['id']}/discovery", json={"transcript": transcript})
    assert r.status_code == 200
    out = r.json()
    assert out["turns"] == 2

    rows = await db.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index",
        out["session_id"],
    )
    assert rows[0]["text"] == "Every morning Burak handles the repricing, has for years."
    assert rows[0]["speaker"] == "respondent"

    # The enqueued job is the STANDARD compile_session, flagged to render the snapshot.
    job = await db.fetchrow("select kind, payload from jobs where id = $1", out["job_id"])
    assert job["kind"] == "compile_session"
    payload = job["payload"]
    assert payload["render_snapshot"] is True
    assert payload["session_id"] == out["session_id"]

    # Session is a completed founder-round interview; the founder was minted as interviewee.
    sess = await db.fetchrow(
        "select status, session_kind, interviewee_id from interview_sessions where id = $1",
        out["session_id"],
    )
    assert sess["status"] == "completed"
    assert sess["session_kind"] == "interview"
    assert sess["interviewee_id"] is not None


async def test_upload_rejects_empty_transcript(db):
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(f"/api/workspaces/{ws['id']}/discovery", json={"transcript": "   "})
    assert r.status_code == 422


async def test_recon_status_reports_scraped_counts(db):
    ws = await _make_company(name="Scan Co", contact=None)
    async with _client() as c:
        started = (await c.post(f"/api/workspaces/{ws['id']}/recon", json={"website_url": "https://x.example"})).json()
    job_id = started["job_id"]
    # Simulate the worker having produced one SCRAPED record + one scraped person.
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text) "
        "values ($1,'statement','company_fact','SCRAPED','Ten boutiques')",
        ws["id"],
    )
    await db.execute(
        "insert into entities (workspace_id, entity_type, canonical_name, source) "
        "values ($1,'person','Web Person','scraped')",
        ws["id"],
    )
    await db.execute("update jobs set status = 'done' where id = $1", job_id)
    async with _client() as c:
        st = (await c.get(f"/api/workspaces/{ws['id']}/recon/status?job_id={job_id}")).json()
    assert st["job_status"] == "done"
    assert st["scraped_records"] == 1
    assert st["people"] == 1


async def test_status_reports_stages_from_jobs(db):
    ws = await _make_company()
    async with _client() as c:
        out = (
            await c.post(
                f"/api/workspaces/{ws['id']}/discovery",
                json={"transcript": "Ece: returns are a headache."},
            )
        ).json()
    sid = out["session_id"]

    # Simulate the worker having finished the compile and fanned out one job.
    await db.execute("update jobs set status = 'done' where id = $1", out["job_id"])
    await db.execute(
        "insert into jobs (kind, payload, status) values "
        "('render_snapshot', $1, 'queued')",
        json.dumps({"session_id": sid, "workspace_id": ws["id"]}),
    )

    async with _client() as c:
        st = (await c.get(f"/api/workspaces/{ws['id']}/discovery/{sid}/status")).json()
    kinds = {s["kind"]: s["status"] for s in st["stages"]}
    assert kinds["compile_session"] == "done"
    assert kinds["render_snapshot"] == "queued"
    assert st["state"] == "running"
