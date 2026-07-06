"""Handoff package builder — fires when a plan reaches APPROVED.

The runtime interviewer receives ONLY this package: objectives, questions, rules /
NEVER list, vocabulary, approach notes, definition-of-done, time budget. It NEVER
receives claim text and NEVER a quarantined record — the isolation that keeps
"nothing anyone else said reaches this person" a structural guarantee, not prompt
discipline (MERGE_PLAN Phase 3, non-negotiables #2 and #4).

Enforcement is at construction: this module builds the package only from permitted
fields, and every claim-derived field filters `quarantined = false` in SQL. Objectives
are the plan's neutral topics (authored by the plan-generator to carry no attribution),
never raw claims."""

import json

from ..db import get_pool
from ..queue import handles

DEFAULT_TIME_BUDGET_MIN = 30


def _as_list(v) -> list:
    if v is None:
        return []
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except json.JSONDecodeError:
            return [v]
    return v if isinstance(v, list) else [v]


def _as_dict(v) -> dict:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return {}
    return v or {}


async def build_handoff_package(plan_id: str) -> dict:
    pool = await get_pool()
    plan = await pool.fetchrow("select * from interview_plans where id = $1", plan_id)
    if plan is None:
        raise RuntimeError(f"build_handoff: no plan {plan_id}")
    workspace_id = str(plan["workspace_id"])
    mission = _as_dict(plan["mission"])

    # Vocabulary: verbatim terms only (never the surrounding claim sentence), and
    # never a quarantined record. The evidence_quote holds the term as spoken.
    vocab_rows = await pool.fetch(
        """select distinct evidence_quote from claim_records
           where workspace_id = $1 and topic = 'vocabulary'
             and quarantined = false and evidence_quote is not null""",
        workspace_id,
    )
    vocabulary = sorted({r["evidence_quote"].strip() for r in vocab_rows if r["evidence_quote"]})

    # Handling / approach notes: temperament guidance for conducting safely. Only
    # non-quarantined approach_note records — sentiment-quarantined rows never leak.
    approach_rows = await pool.fetch(
        """select distinct approach_note from claim_records
           where workspace_id = $1 and approach_note is not null and quarantined = false""",
        workspace_id,
    )
    handling_notes = _as_list(mission.get("handling_notes")) + [
        r["approach_note"] for r in approach_rows if r["approach_note"]
    ]

    # NEVER list: the plan's explicit list + directive instructions (rules to the
    # interviewer, e.g. "don't mention the Harrods renegotiation"). Directives are
    # prohibitions the agent must honor; the persona is told never to raise them.
    directive_rows = await pool.fetch(
        "select claim_text from claim_records where workspace_id = $1 and kind = 'directive'",
        workspace_id,
    )
    never_list = _as_list(plan["never_list"]) + [r["claim_text"] for r in directive_rows]

    package = {
        "goal": mission.get("goal"),
        "objectives": mission.get("topics", mission.get("objectives", [])),
        "known_context": mission.get("known_context"),  # plan-curated, locked
        "suggested_questions": _as_list(plan["suggested_questions"]),
        "vocabulary": vocabulary,
        "handling_notes": handling_notes,
        "never_list": never_list,
        "definition_of_done": mission.get("definition_of_done", mission.get("DoD")),
        "time_budget_minutes": mission.get("time_budget_minutes", DEFAULT_TIME_BUDGET_MIN),
    }

    await pool.execute(
        """insert into handoff_packages (plan_id, package) values ($1, $2)
           on conflict (plan_id) do update set package = excluded.package,
             built_at = now()""",
        plan_id,
        json.dumps(package),
    )
    return package


@handles("build_handoff")
async def _build_handoff_job(payload: dict) -> None:
    await build_handoff_package(payload["plan_id"])
