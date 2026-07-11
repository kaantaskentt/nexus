"""Plan generation wiring (#30): POST /api/plans/generate mints a DRAFT plan and enqueues
the standard generate_plan job; the job persists the plan and advances it to NEXUS_CHECK
(A4). Non-negotiable #4: quarantined sentiment can never reach the plan generator."""


from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import plan as plan_pipeline
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _person(db, ws, name="Selin", role="Returns"):
    return await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, role, source) "
        "values ($1,'person',$2,$3,'interview') returning id",
        ws, name, role,
    )


async def _seed_record(db, ws):
    """A workspace can only draft plans once a context call has compiled records
    (client_visible_claims). Endpoint tests that exercise the drafting wiring seed one so
    they clear the honest precheck — the realistic post-context-call state."""
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1,'statement','process_step','CLAIMED','Returns are handled each morning', false)",
        ws,
    )


async def test_generate_endpoint_creates_draft_and_enqueues(db):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    await _seed_record(db, ws)
    async with _client() as c:
        r = await c.post("/api/plans/generate", json={"workspace_id": str(ws), "entity_id": str(person)})
    assert r.status_code == 200
    out = r.json()
    assert out["state"] == "DRAFT"

    row = await db.fetchrow("select state, interviewee_id from interview_plans where id = $1", out["plan_id"])
    assert row["state"] == "DRAFT"
    assert str(row["interviewee_id"]) == str(person)

    job = await db.fetchrow("select kind, payload from jobs where id = $1", out["job_id"])
    assert job["kind"] == "generate_plan"
    assert job["payload"]["plan_id"] == out["plan_id"]


async def test_generate_endpoint_resolves_person_by_name(db):
    ws = await make_workspace(db, industry="jewelry")
    await _seed_record(db, ws)
    async with _client() as c:
        r = await c.post(
            "/api/plans/generate",
            json={"workspace_id": str(ws), "person_name": "Deniz", "person_role": "Ops"},
        )
    assert r.status_code == 200
    # The person was minted as a client-side entity.
    ent = await db.fetchrow("select canonical_name, role from entities where workspace_id=$1", ws)
    assert ent["canonical_name"] == "Deniz"


async def test_generate_endpoint_requires_person(db):
    ws = await make_workspace(db, industry="jewelry")
    await _seed_record(db, ws)
    async with _client() as c:
        r = await c.post("/api/plans/generate", json={"workspace_id": str(ws)})
    assert r.status_code == 422


async def test_generate_requires_compiled_records(db):
    """Costume 2: drafting with nothing compiled fails fast (422) with the real CTA,
    never a doomed job that spins for minutes."""
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    async with _client() as c:
        r = await c.post("/api/plans/generate", json={"workspace_id": str(ws), "entity_id": str(person)})
    assert r.status_code == 422
    assert "context call" in r.json()["detail"]
    # No DRAFT plan and no job were created.
    assert await db.fetchval("select count(*) from interview_plans where workspace_id=$1", ws) == 0
    assert await db.fetchval("select count(*) from jobs where kind='generate_plan'") == 0


async def test_generate_plan_job_persists_and_advances(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id",
        ws, person,
    )

    generated = {
        "goal": "Understand how online returns are handled day to day",
        "interview_topic": "the returns process",
        "known_context": ["Returns run through one person"],
        "topics": [{"label": "The returns workflow end to end", "must_hit": True,
                    "detail": "one recent episode, steps, tools, exceptions"}],
        "definition_of_done": ["one returns episode walked through in order"],
        "handling_notes": ["keep it concrete"],
        "never_list": ["Do not name or characterize any colleague"],
        "vocabulary": ["yildirim"],
        "suggested_questions": [{"text": "Walk me through the last return you processed.",
                                 "topic": "process_step", "audience": "does_the_work"}],
        "time_budget_minutes": 30,
    }

    async def _fake(agent_name, user_content, **kw):
        assert agent_name == "plan_generator"
        return generated

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _fake)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})

    row = await db.fetchrow(
        "select state, mission, suggested_questions, never_list from interview_plans where id=$1",
        plan_id,
    )
    assert row["state"] == "NEXUS_CHECK"
    mission = row["mission"]
    assert mission["goal"].startswith("Understand how online returns")
    assert mission["topics"][0]["must_hit"] is True
    assert row["never_list"] == ["Do not name or characterize any colleague"]
    assert row["suggested_questions"][0]["topic"] == "process_step"

    # The lifecycle move is recorded.
    t = await db.fetchrow(
        "select from_state, to_state, actor from plan_state_transitions where plan_id=$1", plan_id)
    assert (t["from_state"], t["to_state"], t["actor"]) == ("DRAFT", "NEXUS_CHECK", "system")


async def test_generate_plan_excludes_quarantined_records(db, monkeypatch):
    """The generator must never see a quarantined record (sentiment about a named person)."""
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) values ($1,$2,'DRAFT') returning id",
        ws, person,
    )
    # A safe process record (visible) and a quarantined sentiment record (must be excluded).
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1,'statement','process_step','CLAIMED','Returns are handled every morning', false)", ws)
    await db.execute(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text, sentiment_flag, quarantined) "
        "values ($1,'statement','person',null,'The founder thinks Selin is careless', true, true)", ws)

    seen = {}

    async def _capture(agent_name, user_content, **kw):
        seen["content"] = user_content
        return {"goal": "x", "topics": [], "suggested_questions": [], "never_list": []}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _capture)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})

    assert "handled every morning" in seen["content"]          # visible record reached it
    assert "careless" not in seen["content"]                    # quarantined never did


# ── Custom interview door (Kaan product ask, July 7) ─────────────────────────


async def test_generate_endpoint_passes_custom_goal(db):
    """POST /generate with a free-text goal carries it into the job payload; the gate
    (DRAFT -> NEXUS_CHECK -> human approval) is unchanged."""
    ws = await make_workspace(db, industry="jewelry")
    await _seed_record(db, ws)
    async with _client() as c:
        r = await c.post(
            "/api/plans/generate",
            json={"workspace_id": str(ws), "person_name": "Deniz",
                  "goal": "Find out how returns really get authorized"},
        )
    assert r.status_code == 200
    out = r.json()
    assert out["state"] == "DRAFT"
    job = await db.fetchrow("select payload from jobs where id = $1", out["job_id"])
    assert job["payload"]["custom_goal"] == "Find out how returns really get authorized"


async def test_generate_plan_job_honors_custom_goal(db, monkeypatch):
    """The custom focus reaches the generator's context and lands on mission.custom_focus
    (honest provenance for the review screen)."""
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id",
        ws, person,
    )
    seen = {}

    async def _capture(agent_name, user_content, **kw):
        seen["content"] = user_content
        return {"goal": "g", "topics": [], "suggested_questions": [], "never_list": []}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _capture)
    await plan_pipeline.generate_plan(
        {"plan_id": str(plan_id), "workspace_id": str(ws),
         "custom_goal": "Find out how returns really get authorized"}
    )
    assert "Admin's custom focus" in seen["content"]
    assert "returns really get authorized" in seen["content"]

    mission = (await db.fetchrow("select mission from interview_plans where id=$1", plan_id))["mission"]
    assert mission["custom_focus"] == "Find out how returns really get authorized"

    # A record-derived plan keeps honest None provenance.
    plan2 = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id", ws, person)
    await plan_pipeline.generate_plan({"plan_id": str(plan2), "workspace_id": str(ws)})
    mission2 = (await db.fetchrow("select mission from interview_plans where id=$1", plan2))["mission"]
    assert mission2["custom_focus"] is None

async def test_generate_heals_stale_entity_id_via_name(db):
    """A provided entity_id that isn't in the workspace (stale/corrupted card) must not
    500 — it falls back to resolving by name so the journey survives (Emre doc-2 P1)."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    from tests.conftest import make_workspace
    ws = await make_workspace(db, industry="jewelry")
    await _seed_record(db, ws)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/api/plans/generate", json={
            "workspace_id": str(ws),
            "entity_id": "00000000-0000-0000-0000-00000000dead",
            "person_name": "Melis", "person_role": "Digest owner",
        })
    assert r.status_code == 200
    plan_id = r.json()["plan_id"]
    name = await db.fetchval(
        "select e.canonical_name from interview_plans p join entities e on e.id=p.interviewee_id "
        "where p.id=$1", plan_id)
    assert name == "Melis"


# ── F7: validated artifact-sharing authorization state ───────────────────────────────
from app.pipeline.plan import _resolve_artifact_authorization, _records_block  # noqa: E402
from tests.conftest import make_session  # noqa: E402


async def _auth_record(db, ws, session_id=None):
    return await db.fetchval(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1,$2,'statement','tool','CONFIRMED',"
        "'The founder confirmed employees may share their completed questionnaires', false) returning id",
        ws, session_id,
    )


async def test_f7_authorization_valid_citation(db):
    """Explicit authorization + a real cited record → authorized true, with the record's
    session as auditable source and the evidence id retained."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    rec_id = await _auth_record(db, ws, sess)
    out = await _resolve_artifact_authorization(
        db, str(ws), "plan-x",
        {"artifact_sharing_authorized": True, "evidence_record_id": str(rec_id)},
    )
    assert out["authorized"] is True
    assert out["evidence_record_id"] == str(rec_id)
    assert out["source_session_id"] == str(sess)


async def test_f7_no_claim_is_false(db):
    ws = await make_workspace(db, industry="jewelry")
    assert await _resolve_artifact_authorization(db, str(ws), "p", {}) == {"authorized": False}


async def test_f7_true_without_evidence_id_forced_false(db):
    """The amendment: a bare true with no citation is discarded (fail-closed)."""
    ws = await make_workspace(db, industry="jewelry")
    out = await _resolve_artifact_authorization(db, str(ws), "p", {"artifact_sharing_authorized": True})
    assert out == {"authorized": False}


async def test_f7_hallucinated_or_foreign_record_forced_false(db):
    """A citation that doesn't resolve to a record IN THIS workspace is discarded — a
    hallucinated id, and (cross-tenant guard) a real id from another workspace, both force false."""
    ws = await make_workspace(db, industry="jewelry")
    ws2 = await make_workspace(db, industry="jewelry")
    foreign = await _auth_record(db, ws2, None)
    bogus = await _resolve_artifact_authorization(
        db, str(ws), "p", {"artifact_sharing_authorized": True, "evidence_record_id": "not-a-real-id"})
    assert bogus == {"authorized": False}
    cross = await _resolve_artifact_authorization(
        db, str(ws), "p", {"artifact_sharing_authorized": True, "evidence_record_id": str(foreign)})
    assert cross == {"authorized": False}


async def test_f7_records_block_exposes_ids(db):
    """The generator can only cite an id the records block actually shows it."""
    ws = await make_workspace(db, industry="jewelry")
    rec_id = await _auth_record(db, ws, None)
    block = await _records_block(db, str(ws))
    assert f"[{rec_id}]" in block


async def test_f7_generate_plan_sets_mission_authorization(db, monkeypatch):
    """End to end: the job writes the validated authorization dict onto the mission."""
    ws = await make_workspace(db, industry="jewelry")
    person = await _person(db, ws)
    sess = await make_session(db, ws)
    rec_id = await _auth_record(db, ws, sess)
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) values ($1,$2,'DRAFT') returning id",
        ws, person,
    )

    async def _fake(agent_name, user_content, **kw):
        return {"goal": "g", "topics": [], "suggested_questions": [], "never_list": [],
                "artifact_sharing_authorized": True, "evidence_record_id": str(rec_id)}

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _fake)
    await plan_pipeline.generate_plan({"plan_id": str(plan_id), "workspace_id": str(ws)})

    mission = (await db.fetchrow("select mission from interview_plans where id=$1", plan_id))["mission"]
    auth = mission["artifact_sharing_authorized"]
    assert auth["authorized"] is True
    assert auth["source_session_id"] == str(sess)
    assert auth["evidence_record_id"] == str(rec_id)


async def test_generate_plan_thin_person_instruction_and_marker(db, monkeypatch):
    """WS-3 (round-2 3.1): a workspace rich in records about OTHER people + a person the
    store barely knows must (a) tell the generator the person's records are THIN with the
    no-borrowing instruction, (b) mark the mission records_thin so the review surface says
    so. Control: a person with enough records about them gets neither."""
    ws = await make_workspace(db, industry="jewelry")
    thin = await _person(db, ws, name="Ahmet Yayci", role="office assistant")
    rich = await _person(db, ws, name="Berk Bilmemne", role="delivery lead")
    # Rich workspace: several records ABOUT Berk, none about Ahmet.
    for txt in (
        "Berk Bilmemne reviews every deck before it ships",
        "Berk Bilmemne heads three delivery teams",
        "Berk Bilmemne re-ran the analysis during the glass manufacturer crisis",
    ):
        await db.execute(
            "insert into claim_records (workspace_id, kind, topic, tag, claim_text, subject_id, quarantined) "
            "values ($1,'statement','person','CLAIMED',$2,$3,false)",
            ws, txt, rich,
        )

    seen: dict[str, str] = {}
    generated = {
        "goal": "g", "interview_topic": "t", "known_context": [], "topics": [],
        "definition_of_done": [], "handling_notes": [], "never_list": [],
        "vocabulary": [], "suggested_questions": [], "time_budget_minutes": 30,
    }

    async def _capture(agent_name, user_content, **kw):
        seen["content"] = user_content
        return generated

    monkeypatch.setattr("app.pipeline.plan.run_agent_json", _capture)

    # Thin person: instruction present + mission marked.
    thin_plan = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id", ws, thin)
    await plan_pipeline.generate_plan({"plan_id": str(thin_plan), "workspace_id": str(ws)})
    assert "THIN" in seen["content"]
    assert "Do NOT transfer any other individual's duties" in seen["content"]
    mission = await db.fetchval("select mission from interview_plans where id=$1", thin_plan)
    assert mission["records_thin"] is True
    assert mission["person_record_count"] == 0

    # Rich person (3 records about them): no thin instruction, honest marker false.
    rich_plan = await db.fetchval(
        "insert into interview_plans (workspace_id, interviewee_id, state) "
        "values ($1,$2,'DRAFT') returning id", ws, rich)
    await plan_pipeline.generate_plan({"plan_id": str(rich_plan), "workspace_id": str(ws)})
    assert "THIN" not in seen["content"]
    mission = await db.fetchval("select mission from interview_plans where id=$1", rich_plan)
    assert mission["records_thin"] is False
    assert mission["person_record_count"] == 3
