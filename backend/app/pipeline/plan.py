"""Plan generation (Phase 3) — compiled records → an interview plan for one named person.

Judgment lives in prompts/agents/plan-generator.md (the IP, STRONG seat). This module owns
the machine contract and the ontology guards:

  - Reads ONLY `client_visible_claims`, so quarantined sentiment about the person can never
    enter the plan (non-negotiable #4 — the prompt's cardinal constraint, enforced here at
    the data layer, not by trusting the model).
  - Hands the plan_generator seat the person + records + industry calibration (A14) + a
    strict JSON contract, then persists the mission / questions / NEVER-list.
  - Moves the plan into the review lifecycle at NEXUS_CHECK (A4: Nexus checks before the
    admin sees it). A human still approves before anything sends — the gate is downstream.

Fail-loud (#22): unparseable generator output raises AgentParseError, so the job fails and
retries and the plan stays at DRAFT — never a half-written plan advanced into review.
"""

import json
import logging

from datetime import datetime, timezone

from ..db import get_pool, loads
from ..llm import run_agent_json
from ..queue import enqueue, handles
from .compiler import _load_industry_block

log = logging.getLogger("nexus.plan")

OUTPUT_CONTRACT = """
## Output — return ONE json object, nothing else

```json
{
  "goal": "one sentence: what this interview is for",
  "interview_topic": "the neutral area label the invite/consent shows (never who-said-what)",
  "known_context": ["only what is safe for THIS respondent to know we know"],
  "topics": [
    {"label": "objective phrased as your own neutral curiosity", "must_hit": true,
     "detail": "completion condition: what 'enough evidence' means (episode + steps + tools + exceptions)"}
  ],
  "definition_of_done": ["must-hits covered to spine-completeness"],
  "handling_notes": ["temperament / register cues; an exec's read is marked unverified"],
  "never_list": ["hard exclusions: topics/names/framings to avoid; outranks every objective"],
  "vocabulary": ["the company's verbatim terms, untranslated"],
  "suggested_questions": [
    {"text": "open, non-leading, episodic question", "topic": "process_step", "audience": "does_the_work"}
  ],
  "time_budget_minutes": 30,
  "artifact_sharing_authorized": false,
  "evidence_record_id": null
}
```

Objectives only — never claim text, quotes, or who-said-what. No em-dashes in authored text.

`artifact_sharing_authorized`: true ONLY if a record above EXPLICITLY states the sponsor
authorized or agreed that employees may share their real work artifacts (a file, template,
completed form, export). Never infer it from enthusiasm, tone, or the mere existence of
artifacts. When true, set `evidence_record_id` to the exact [id] of that record; when in any
doubt, set false and null. This is checked against the real records, so a citation that does
not back an explicit authorization is discarded.
"""


async def _person(pool, entity_id) -> tuple[str | None, str | None]:
    if entity_id is None:
        return None, None
    row = await pool.fetchrow("select canonical_name, role from entities where id = $1", entity_id)
    return (row["canonical_name"], row["role"]) if row else (None, None)


# WS-3 (Emre round-2 §3.1): below this many person-specific records, the store is THIN on
# the named person and the generator must scaffold from the role, never borrow the nearest
# strong entity's material (Ahmet got the CEO's due-diligence must-hits + "managing thirty").
THIN_PERSON_THRESHOLD = 3


async def _person_record_count(pool, workspace_id: str, entity_id, name: str | None) -> int:
    """How many client-visible records are actually ABOUT this person — by subject link
    or by name in the claim text. Speaker rows don't count: what the person SAID elsewhere
    isn't evidence about their own work here."""
    if entity_id is None and not name:
        return 0
    return await pool.fetchval(
        """select count(*) from client_visible_claims
           where workspace_id = $1
             and (($2::uuid is not null and subject_id = $2)
                  or ($3::text is not null and claim_text ilike '%' || $3 || '%'))""",
        workspace_id, entity_id, name,
    ) or 0


async def _records_block(pool, workspace_id: str) -> str:
    # Deny-by-default: client_visible_claims omits quarantined rows, so sentiment about a
    # named person can never reach the plan generator (non-negotiable #4).
    rows = await pool.fetch(
        "select id, kind, topic, tag, claim_text from client_visible_claims "
        "where workspace_id = $1 order by created_at limit 120",
        workspace_id,
    )
    if not rows:
        return "(no compiled records yet)"
    # The leading [id] lets the generator cite the exact record backing an artifact-sharing
    # authorization (F7). It is an internal reference only, never client-visible text.
    return "\n".join(
        f"- [{r['id']}] {r['kind']}/{r['topic']}/{r['tag'] or 'n/a'}: {r['claim_text']}" for r in rows
    )


async def _resolve_artifact_authorization(pool, workspace_id: str, plan_id: str, data: dict) -> dict:
    """F7: validated artifact-sharing authorization state for the mission.

    The context call captures the sponsor authorizing employees to share their work
    artifacts; the interviewer only invokes that blessing when it is real. A false positive
    is a consent harm (an employee told "the founder authorized this" untruthfully), so this
    is STRUCTURAL, not contractual: authorized is true ONLY when the generator cited an
    evidence record id that actually exists in THIS workspace's client-visible records. A
    missing or invalid citation forces authorized=false with a warning; an absent claim is
    false. Fail-closed — absent behaves byte-identically to before this fix.
    """
    if not data.get("artifact_sharing_authorized"):
        return {"authorized": False}
    rec_id = str(data.get("evidence_record_id") or "").strip()
    if not rec_id:
        log.warning("plan %s: artifact_sharing_authorized asserted with no evidence_record_id — forcing false", plan_id)
        return {"authorized": False}
    # id::text compare avoids a cast error on a malformed/hallucinated id (just no match).
    row = await pool.fetchrow(
        "select session_id from client_visible_claims where id::text = $1 and workspace_id = $2",
        rec_id, workspace_id,
    )
    if row is None:
        log.warning(
            "plan %s: artifact authorization cites record %s not in workspace %s — forcing false",
            plan_id, rec_id, workspace_id,
        )
        return {"authorized": False}
    return {"authorized": True, "source_session_id": str(row["session_id"]), "evidence_record_id": rec_id}


async def generate_plan(payload: dict) -> None:
    """Job handler: turn the workspace's records into a plan for one named person."""
    plan_id = payload["plan_id"]
    workspace_id = payload["workspace_id"]
    pool = await get_pool()

    plan = await pool.fetchrow(
        "select p.interviewee_id, p.state, w.industry from interview_plans p "
        "join workspaces w on w.id = p.workspace_id where p.id = $1",
        plan_id,
    )
    if plan is None:
        raise RuntimeError(f"generate_plan: no plan {plan_id}")

    name, role = await _person(pool, plan["interviewee_id"])
    records = await _records_block(pool, workspace_id)

    # WS-3 entity-bleed guard: measure how much the store actually knows about THIS person
    # and say so to the generator explicitly. The instruction (not the count alone) is what
    # prevents borrowing — the round-2 failure drafted Ahmet's plan from the CEO's job
    # description because the workspace records were rich while the person's were thin.
    person_records = await _person_record_count(pool, workspace_id, plan["interviewee_id"], name)
    records_thin = person_records < THIN_PERSON_THRESHOLD
    person_line = (
        f"\n\nRecords specifically about this person: {person_records}."
        + (
            " THIN. The store barely knows this person: scaffold objectives from their ROLE"
            " at full domain competence, framed to-verify (the delta principle), and say so"
            " honestly in the goal. Do NOT transfer any other individual's duties, review"
            " responsibilities, temperament reads, or handling notes onto them: an objective"
            " or handling note is only theirs if a record about THEM (or their stated role)"
            " supports it. Where only the operator can close the gap, surface it as an open"
            " question in the plan rather than guessing."
            if records_thin else ""
        )
    )

    context = (
        "# Person to interview\n"
        + (name or "the suggested person")
        + (f" ({role})" if role else "")
        + person_line
        + "\n\n# Compiled records (client-visible; derive neutral objectives, never transmit content)\n"
        + records
    )
    # Custom interview (Kaan, July 7): the admin's free-text focus aims the mission.
    # Every existing rule still binds — objectives stay neutral, nothing anyone said is
    # transmitted, and the plan still passes NEXUS_CHECK + human approval before sending.
    custom_goal = (payload.get("custom_goal") or "").strip()
    if custom_goal:
        context = (
            "# Admin's custom focus for this interview\n"
            f"{custom_goal}\n"
            "Aim the goal and objectives at this focus, grounded in the records below. "
            "The same rules bind: derive neutral objectives, never transmit anyone's "
            "statements to the interviewee.\n\n"
        ) + context
    turn = "Generate the interview plan for this person now."
    user_content = f"{context}\n\n{turn}\n{OUTPUT_CONTRACT}"

    data = await run_agent_json(
        "plan_generator",
        user_content,
        workspace_id=workspace_id,
        industry_block=_load_industry_block(plan["industry"]),
        max_tokens=4000,
    )

    artifact_auth = await _resolve_artifact_authorization(pool, workspace_id, plan_id, data)
    mission = {
        "goal": data.get("goal", ""),
        "interview_topic": data.get("interview_topic") or data.get("goal", ""),
        "known_context": data.get("known_context") or [],
        "topics": data.get("topics") or [],
        "definition_of_done": data.get("definition_of_done") or [],
        "handling_notes": data.get("handling_notes") or [],
        "vocabulary": data.get("vocabulary") or [],
        "time_budget_minutes": data.get("time_budget_minutes") or 30,
        # Honest provenance: the admin's own focus text, kept on the mission so the
        # review screen shows what this plan was aimed at. None for record-derived plans.
        "custom_focus": custom_goal or None,
        # WS-3: honest thinness marker — the review surface tells the admin the store
        # barely knows this person, so they enrich via intake instead of approving a guess.
        "records_thin": records_thin,
        "person_record_count": person_records,
        # F7: validated sponsor authorization for employees to share artifacts. Structural,
        # fail-closed, auditable ({authorized, source_session_id, evidence_record_id}).
        "artifact_sharing_authorized": artifact_auth,
    }
    questions = data.get("suggested_questions") or []
    never = data.get("never_list") or []

    # Persist the generated plan and advance into the review lifecycle at NEXUS_CHECK
    # (A4: Nexus checks before the admin sees it). DRAFT → NEXUS_CHECK is a legal move;
    # we record the transition the same way the router does.
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            "update interview_plans set mission=$2, suggested_questions=$3, never_list=$4, "
            "state='NEXUS_CHECK', updated_at=now() where id=$1",
            plan_id, json.dumps(mission), json.dumps(questions), json.dumps(never),
        )
        await conn.execute(
            "insert into plan_state_transitions (plan_id, from_state, to_state, actor, note) "
            "values ($1, 'DRAFT', 'NEXUS_CHECK', 'system', 'plan generated from records')",
            plan_id,
        )
    log.info("generate_plan: plan %s generated (%d topics) → NEXUS_CHECK", plan_id, len(mission["topics"]))
    # A4 for real (premium audit P0-1): the reviewer seat was seeded in 0001 but never
    # wired, so every plan parked in NEXUS_CHECK forever and Approve 409'd. The check
    # now actually runs, and IT moves the plan forward.
    await enqueue("nexus_check", {"plan_id": plan_id, "workspace_id": workspace_id}, priority=90)


async def run_nexus_check(payload: dict) -> None:
    """Run the Nexus-check reviewer over a generated plan (A4: Nexus checks before the
    admin approves). PASS → AWAITING_APPROVAL; RETURN → DRAFT. Either way the verdict
    and every flag land in the plan's change_log — the gate is auditable, never silent.
    Idempotent: only acts on a plan still sitting in NEXUS_CHECK."""
    plan_id = payload["plan_id"]
    pool = await get_pool()
    plan = await pool.fetchrow(
        "select p.state, p.mission, p.suggested_questions, p.never_list, p.change_log, "
        "w.industry from interview_plans p join workspaces w on w.id = p.workspace_id "
        "where p.id = $1",
        plan_id,
    )
    if plan is None:
        raise RuntimeError(f"nexus_check: no plan {plan_id}")
    if plan["state"] != "NEXUS_CHECK":
        return


    mission = loads(plan["mission"], {})
    questions = loads(plan["suggested_questions"], [])
    never = loads(plan["never_list"], [])
    change_log = loads(plan["change_log"], [])

    user_content = (
        "# Plan to review\n"
        f"mission: {json.dumps(mission, ensure_ascii=False)}\n"
        f"suggested_questions: {json.dumps(questions, ensure_ascii=False)}\n"
        f"never_list: {json.dumps(never, ensure_ascii=False)}\n\n"
        "Run the Nexus check now. Return ONLY the JSON verdict object."
    )
    data = await run_agent_json(
        "nexus_check_reviewer",
        user_content,
        workspace_id=payload.get("workspace_id"),
        industry_block=_load_industry_block(plan["industry"]),
        max_tokens=3000,
    )
    flags = data.get("flags") or []
    passed = str(data.get("verdict", "")).strip().upper() == "PASS" and not any(
        f.get("severity") == "fail" for f in flags
    )
    change_log.append({
        "at": datetime.now(timezone.utc).isoformat(),
        "actor": "nexus_check",
        "verdict": "PASS" if passed else "RETURN",
        "flags": flags,
        "indirect_routes": data.get("indirect_routes") or [],
    })
    to_state = "AWAITING_APPROVAL" if passed else "DRAFT"
    note = (
        f"Nexus check {'passed' if passed else 'returned the plan'} "
        f"({len(flags)} flag{'s' if len(flags) != 1 else ''})"
    )
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            "update interview_plans set state=$2, change_log=$3, updated_at=now() "
            "where id=$1 and state='NEXUS_CHECK'",
            plan_id, to_state, json.dumps(change_log),
        )
        await conn.execute(
            "insert into plan_state_transitions (plan_id, from_state, to_state, actor, note) "
            "values ($1, 'NEXUS_CHECK', $2, 'nexus_check', $3)",
            plan_id, to_state, note,
        )
    log.info("nexus_check: plan %s → %s (%d flags)", plan_id, to_state, len(flags))


@handles("nexus_check")
async def _nexus_check_job(payload: dict) -> None:
    await run_nexus_check(payload)


@handles("generate_plan")
async def _generate_plan_job(payload: dict) -> None:
    await generate_plan(payload)
