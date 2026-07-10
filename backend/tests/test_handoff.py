"""Handoff builder — the deny-by-default guarantee. A quarantined record or raw
claim text leaking into the package would breach non-negotiables #2 and #4, so these
assert the package is built ONLY from permitted fields."""

import json

from app.pipeline.handoff import build_handoff_package
from tests.conftest import make_workspace


async def _make_plan(pool, workspace_id):
    mission = {
        "goal": "Understand the returns workflow end to end",
        "topics": [{"objective": "How returns are processed", "tier": "must_hit"}],
        "definition_of_done": "One specific returns episode with steps in order",
        "handling_notes": ["Keep it light — newer employee"],
        "time_budget_minutes": 25,
    }
    return await pool.fetchval(
        """insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list)
           values ($1, 'APPROVED', $2, $3, $4) returning id""",
        workspace_id,
        json.dumps(mission),
        json.dumps(["Walk me through the last return you handled."]),
        json.dumps(["Don't discuss salaries"]),
    )


async def _claim(pool, ws, **over):
    cols = dict(kind="statement", topic="company_fact", tag="CLAIMED", claim_text="x",
                evidence_quote=None, approach_note=None, sentiment_flag=False, quarantined=False)
    cols.update(over)
    await pool.execute(
        """insert into claim_records (workspace_id, kind, topic, tag, claim_text,
             evidence_quote, approach_note, sentiment_flag, quarantined)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
        ws, cols["kind"], cols["topic"], cols["tag"], cols["claim_text"],
        cols["evidence_quote"], cols["approach_note"], cols["sentiment_flag"], cols["quarantined"],
    )


async def test_handoff_denies_quarantine_and_claim_text(db):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _make_plan(db, ws)

    await _claim(db, ws, topic="vocabulary", tag="CLAIMED",
                claim_text="The team calls rush orders yıldırım", evidence_quote="yıldırım sipariş")
    await _claim(db, ws, topic="person", approach_note="Gets nervous about systems people")
    await _claim(db, ws, kind="directive", tag=None,
                claim_text="Do not mention the acquisition talks")
    # MUST NOT leak: a quarantined sentiment record + an ordinary pain claim's text.
    await _claim(db, ws, topic="person", sentiment_flag=True, quarantined=True,
                claim_text="SECRET_JUDGMENT Metin is disorganized")
    await _claim(db, ws, topic="pain", tag="CONFIRMED",
                claim_text="SECRET_PAIN returns pile up every morning")

    package = await build_handoff_package(str(plan_id))
    blob = json.dumps(package, ensure_ascii=False)

    # Permitted fields present.
    assert "yıldırım sipariş" in package["vocabulary"]
    assert any("nervous about systems" in h for h in package["handling_notes"])
    assert any("Keep it light" in h for h in package["handling_notes"])
    assert any("acquisition" in n for n in package["never_list"])
    assert any("salaries" in n for n in package["never_list"])
    assert package["time_budget_minutes"] == 25
    assert package["goal"].startswith("Understand the returns")

    # Deny-by-default: no quarantined content, no ordinary claim text.
    assert "SECRET_JUDGMENT" not in blob
    assert "SECRET_PAIN" not in blob
    assert "disorganized" not in blob

    # Persisted to handoff_packages.
    stored = await db.fetchval("select package from handoff_packages where plan_id = $1", plan_id)
    assert stored is not None


async def test_handoff_drops_known_context_and_strips_attribution(db):
    """QA F1: known_context is never carried, and attribution-shaped free text in a
    dirty plan is stripped at construction — the guarantee holds even if the plan is
    messy (the who-said-what never reaches the interviewer)."""
    ws = await make_workspace(db, industry="jewelry")
    mission = {
        "goal": "Understand the returns workflow",
        "known_context": "Founder quotes ~10 days; production describes ~3 weeks at peak",
        "topics": [
            {"objective": "How returns are processed today", "tier": "must_hit"},
            {"objective": "The CEO said Metin was too slow at returns", "tier": "nice"},
        ],
        "handling_notes": ["Keep it light", "According to the founder he gets defensive"],
        "definition_of_done": "One specific returns episode with steps in order",
    }
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list) "
        "values ($1, 'APPROVED', $2, '[]'::jsonb, '[]'::jsonb) returning id",
        ws, json.dumps(mission),
    )

    package = await build_handoff_package(str(plan_id))
    blob = json.dumps(package, ensure_ascii=False)

    assert "known_context" not in package  # never carried
    assert "Founder quotes" not in blob
    assert "~3 weeks" not in blob
    # The clean objective survives; the attribution-shaped one is dropped whole.
    objective_texts = [o.get("objective") for o in package["objectives"]]
    assert "How returns are processed today" in objective_texts
    assert not any("CEO said" in (t or "") for t in objective_texts)
    # Clean handling note kept; the "According to the founder" one stripped.
    assert any("Keep it light" in h for h in package["handling_notes"])
    assert not any("According to" in h for h in package["handling_notes"])


async def test_handoff_strips_attribution_from_never_list(db):
    """Backstop for the refine-chat guard (non-negotiable #4): an attribution-shaped
    never_list entry is stripped at construction; a clean topic prohibition survives."""
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list) "
        "values ($1, 'APPROVED', '{}'::jsonb, '[]'::jsonb, $2) returning id",
        ws, json.dumps([
            "don't mention that the founder said Burak is slow",  # attribution-shaped
            "Do not mention the Harrods renegotiation",           # clean topic prohibition
        ]),
    )
    package = await build_handoff_package(str(plan_id))
    assert any("Harrods" in n for n in package["never_list"])
    assert not any("Burak is slow" in n for n in package["never_list"])
    assert "founder said" not in json.dumps(package)


async def _plan_with_mission(db, ws, mission):
    return await db.fetchval(
        "insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list) "
        "values ($1,'APPROVED',$2,'[]','[]') returning id",
        ws, json.dumps(mission),
    )


async def test_handoff_artifact_authorization_reads_nested_true(db):
    """F7: build_handoff reads .authorized from the mission's {authorized,...} dict."""
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan_with_mission(db, ws, {
        "goal": "g", "topics": [],
        "artifact_sharing_authorized": {"authorized": True, "source_session_id": "s", "evidence_record_id": "r"},
    })
    package = await build_handoff_package(str(plan_id))
    assert package["artifact_sharing_authorized"] is True


async def test_handoff_artifact_authorization_fail_closed(db):
    """Absent (every plan before F7) and explicit-false both read False — byte-identical to
    the pre-F7 behavior, so the interviewer never invokes an authorization nobody gave."""
    ws = await make_workspace(db, industry="jewelry")
    for mission in ({"goal": "g", "topics": []},
                    {"goal": "g", "topics": [], "artifact_sharing_authorized": {"authorized": False}}):
        plan_id = await _plan_with_mission(db, ws, mission)
        package = await build_handoff_package(str(plan_id))
        assert package["artifact_sharing_authorized"] is False
