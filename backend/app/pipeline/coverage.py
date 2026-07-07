"""Computed coverage tracking (V3 — the structural fix to the coverage-routing gap).

Until now the interviewer held its objective-coverage map "in its head", re-deriving
satisfied/partial/untouched from the replayed transcript each turn (stage7-interviewer.md
"Track coverage silently"; ARCHITECTURE.md flagged the resumable_state `objectives` field
as a static placeholder). That works over a talkative respondent and fails the quiet one:
a must-hit the respondent never volunteers stays untouched and the interview closes with a
hole (evals/e2e/proof-matrix.md: bookkeeper h-bk-3 deadline-tracking, agency ag-2 scope-creep,
both `untouched` on the real engine even after the terse-completion fix).

This module computes the coverage map SERVER-SIDE from the handoff objectives x the running
transcript, via a dedicated classifier seat (agent_configs 'coverage_tracker'), and hands the
turn engine an authoritative map. The engine injects it each turn and hard-gates the close:
while any must-hit objective is unsatisfied the interviewer is told not to move toward wrapping
up and to route a direct probe to the highest-value untouched must-hit first.

Fail-open by design: if the classifier errors or returns garbage, `compute_coverage` returns
None and `build_coverage_block` emits nothing, so the engine degrades to the prior model-side
behavior. A coverage hiccup must never break a live interview (Phase 0 #2: fail loudly in the
log, not into the respondent's turn).
"""

import logging

from ..llm import extract_json, run_agent

log = logging.getLogger("nexus.coverage")


def normalize_objectives(objectives) -> list[dict]:
    """Objectives arrive either as bare strings (real handoff.py topics) or as
    {label, must_hit} dicts (the eval handoffs). Return a uniform [{label, must_hit}].

    must_hit resolution: if NO objective declares must_hit, every objective is a must-hit
    (a bare list means all of them matter). If any declares it, an unspecified one defaults
    to False — the plan author opted into marking the important ones."""
    parsed: list[dict] = []
    any_declared = False
    for obj in objectives or []:
        if isinstance(obj, str):
            label, must = obj.strip(), None
        elif isinstance(obj, dict):
            label = str(obj.get("label") or obj.get("topic") or obj.get("goal") or "").strip()
            must = obj.get("must_hit")
            if must is not None:
                any_declared = True
        else:
            continue
        if label:
            parsed.append({"label": label, "must_hit": must})
    for p in parsed:
        p["must_hit"] = True if p["must_hit"] is None and not any_declared else bool(p["must_hit"])
    return parsed


def _respondent_turns(utterances: list[dict]) -> int:
    return sum(1 for u in utterances if u.get("speaker") == "respondent" and (u.get("text") or "").strip())


async def compute_coverage(
    objectives,
    utterances: list[dict],
    *,
    workspace_id: str | None = None,
    session_id: str | None = None,
) -> list[dict] | None:
    """Return [{label, must_hit, status, evidence}] for each objective, or None on failure
    (caller falls back to model-side coverage). Before the respondent has said anything,
    everything is untouched by definition — return that without spending a model call."""
    objs = normalize_objectives(objectives)
    if not objs:
        return []
    if _respondent_turns(utterances) == 0:
        return [{**o, "status": "untouched", "evidence": "none"} for o in objs]

    transcript = "\n".join(
        f"{'INTERVIEWER' if u.get('speaker') == 'agent' else 'RESPONDENT'}: {u.get('text', '')}"
        for u in utterances
    )
    user = (
        "# Objectives\n"
        + "\n".join(f"- {o['label']}" for o in objs)
        + "\n\n# Transcript so far\n"
        + transcript
        + "\n\nReturn ONLY the JSON array, one entry per objective, same labels and order."
    )
    try:
        raw = await run_agent(
            "coverage_tracker", user, workspace_id=workspace_id, session_id=session_id, max_tokens=1024
        )
        judged = extract_json(raw)
        if not isinstance(judged, list):
            raise ValueError("coverage output was not a JSON array")
    except Exception as e:  # fail-open — never break a turn on the auditor
        log.warning("coverage: computation failed, falling back to model-side (%s)", e)
        return None

    # Map judged statuses back onto our objectives by label (exact, then positional).
    by_label = {str(j.get("label", "")).strip(): j for j in judged if isinstance(j, dict)}
    out: list[dict] = []
    for i, o in enumerate(objs):
        j = by_label.get(o["label"]) or (judged[i] if i < len(judged) and isinstance(judged[i], dict) else {})
        status = str(j.get("status", "untouched")).strip().lower()
        if status not in ("satisfied", "partial", "untouched"):
            status = "untouched"
        out.append({**o, "status": status, "evidence": str(j.get("evidence", "none"))[:200]})
    return out


def build_coverage_block(coverage: list[dict] | None) -> str:
    """Render the computed coverage map as the authoritative turn-engine directive. Pure and
    deterministic (the testable core): None or empty -> no injection (engine falls back). When
    a must-hit is unsatisfied, hard-gate the close and route to the highest-value one first;
    otherwise clear the interviewer to move toward a natural close."""
    if not coverage:
        return ""
    satisfied = [c for c in coverage if c["status"] == "satisfied"]
    partial = [c for c in coverage if c["status"] == "partial"]
    untouched = [c for c in coverage if c["status"] == "untouched"]
    # Highest-value unsatisfied must-hit: untouched (worst) before partial, plan order within.
    must_open = [c for c in untouched if c["must_hit"]] + [c for c in partial if c["must_hit"]]

    def labels(items: list[dict]) -> str:
        return "; ".join(c["label"] for c in items) if items else "(none)"

    lines = [
        "## Coverage status (computed server-side, authoritative)",
        "This is the engine's measured coverage of your objectives from the transcript so far, "
        "not your own estimate. Trust it over your in-head sense of what is covered, and route by it.",
        f"- SATISFIED: {labels(satisfied)}",
        f"- PARTIAL: {labels(partial)}",
        f"- UNTOUCHED: {labels(untouched)}",
        "",
    ]
    if must_open:
        target = must_open[0]
        lines.append(
            f'You still have an unsatisfied MUST-HIT objective: "{target["label"]}". '
            "Do not move toward closing or signal the interview is near done while any must-hit "
            "is unsatisfied. Unless the NEVER list, a respondent time-pressure signal, or the "
            "two-strike rule (the respondent has twice deflected this topic) prevents "
            "it, route THIS turn to that objective: open one direct, specific probe on it now, "
            "anchored to a concrete recent instance. A quiet respondent will not raise it for you, "
            "so you drive to it."
        )
    else:
        lines.append(
            "All must-hit objectives are satisfied. You may move toward a natural close once the "
            "definition-of-done and remaining time are met."
        )
    return "\n".join(lines)
