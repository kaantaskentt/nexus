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

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles
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
  "time_budget_minutes": 30
}
```

Objectives only — never claim text, quotes, or who-said-what. No em-dashes in authored text.
"""


async def _person(pool, entity_id) -> tuple[str | None, str | None]:
    if entity_id is None:
        return None, None
    row = await pool.fetchrow("select canonical_name, role from entities where id = $1", entity_id)
    return (row["canonical_name"], row["role"]) if row else (None, None)


async def _records_block(pool, workspace_id: str) -> str:
    # Deny-by-default: client_visible_claims omits quarantined rows, so sentiment about a
    # named person can never reach the plan generator (non-negotiable #4).
    rows = await pool.fetch(
        "select kind, topic, tag, claim_text from client_visible_claims "
        "where workspace_id = $1 order by created_at limit 120",
        workspace_id,
    )
    if not rows:
        return "(no compiled records yet)"
    return "\n".join(
        f"- {r['kind']}/{r['topic']}/{r['tag'] or 'n/a'}: {r['claim_text']}" for r in rows
    )


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

    context = (
        "# Person to interview\n"
        + (name or "the suggested person")
        + (f" ({role})" if role else "")
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


@handles("generate_plan")
async def _generate_plan_job(payload: dict) -> None:
    await generate_plan(payload)
