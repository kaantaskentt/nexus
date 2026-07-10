"""Simulation scenario derivation (SIMPLIFY I — Run wiring, lane-e half).

A scenario binds a real workspace WORKFLOW (the content to probe) to a proven cast
ARCHETYPE (the play engine) — it never fabricates a playable employee from claim records
(SIMPLIFY-I-DESIGN LOCKED #1: real workflows supply WHAT to probe, proven archetypes supply
WHO). Everything here is derived SERVER-SIDE from the workflow_id the client names; the
browser never supplies the archetype or the interviewer objectives (those would be a
prompt-injection surface into the simulated interviewer). See routers/simulations.py
scenario-run.

Two derivations, kept deliberately separate from the page's display copy (audit-walk's
GET /scenarios): these `objectives` STEER the interviewer under test; their card
`tests_summary` is display prose. Same workflow attributes, different audiences, no shared
source to drift.
"""

from .roleplay import CAST_KEYS

# Department (or role signal) → proven cast archetype. The archetype supplies personality
# and evasions, NOT domain — a jewelry-ops-manager archetype can play the operator of a
# printing workflow (the workflow carries the domain). Matched by substring so "Sales &
# Marketing" still resolves. Every value is guaranteed in CAST_KEYS.
_ARCHETYPE_BY_DEPT: list[tuple[str, str]] = [
    ("finance", "bookkeeper"),
    ("account", "bookkeeper"),          # accounting
    ("book", "bookkeeper"),
    ("sales", "agency-account-manager"),
    ("marketing", "agency-account-manager"),
    ("account manage", "agency-account-manager"),
    ("client", "agency-account-manager"),
    ("front desk", "hotel-frontdesk-lead"),
    ("reception", "hotel-frontdesk-lead"),
    ("customer", "hotel-frontdesk-lead"),
    ("support", "hotel-frontdesk-lead"),
    ("guest", "hotel-frontdesk-lead"),
    ("warehouse", "warehouse-foreman"),
    ("logistic", "warehouse-foreman"),
    ("fulfil", "warehouse-foreman"),
    ("shipping", "warehouse-foreman"),
    ("operations", "jewelry-ops-manager"),
    ("production", "jewelry-ops-manager"),
]
# A generic operator when the department is null/unclassified or matches nothing — never
# guess a domain, just pick the most generic hands-on operator archetype.
_DEFAULT_ARCHETYPE = "jewelry-ops-manager"


def match_archetype(department: str | None) -> str:
    """Best-matched cast archetype for a workflow's department. Always in CAST_KEYS."""
    dept = (department or "").lower()
    for needle, key in _ARCHETYPE_BY_DEPT:
        if needle in dept:
            return key
    return _DEFAULT_ARCHETYPE


def _exceptions(steps: list[dict]) -> list[str]:
    """Collect exception notes from visible steps' spine_slots.exceptions (the A10 slot)."""
    out: list[str] = []
    for s in steps:
        if s.get("hidden"):
            continue
        exc = (s.get("spine_slots") or {}).get("exceptions")
        if isinstance(exc, list):
            out.extend(str(e) for e in exc if e)
        elif isinstance(exc, str) and exc.strip():
            out.append(exc.strip())
    return out


def derive_objectives(effective: dict, confidence: str | None) -> list[str]:
    """The probes the interviewer-under-test must cover, derived from real workflow
    attributes (SIMPLIFY-I-DESIGN §"which workflows qualify"). Never fabricated: each
    objective is grounded in something the mapped workflow actually shows."""
    label = effective.get("name") or "this workflow"
    steps = [s for s in effective.get("steps", []) if not s.get("hidden")]
    objectives = [
        f'Walk through "{label}" end to end, exactly as it really happens — the real '
        "sequence in the respondent's own words, not the tidy version.",
    ]
    exc = _exceptions(steps)
    if exc:
        sample = "; ".join(exc[:3])
        objectives.append(
            "Surface what breaks it: the exceptions, edge cases, and workarounds people "
            f"actually use (known so far: {sample})."
        )
    if confidence in ("low", "medium"):
        objectives.append(
            "This process is thinly corroborated — press for specifics and concrete "
            "episodes, and note where the account differs from the mapped steps."
        )
    unclear = [s for s in steps if s.get("status") != "verified"]
    if unclear:
        titles = ", ".join((s.get("title") or "a step") for s in unclear[:3])
        objectives.append(f"Pin down the steps that are not yet clear: {titles}.")
    return objectives


def confidence_of(effective: dict) -> str | None:
    """Workflow-level confidence from the share of VISIBLE steps corroborated (verified),
    same ladder vocabulary as the Workflows list: High >=0.7, Medium >=0.35, else Low.
    None when there are no visible steps."""
    steps = [s for s in effective.get("steps", []) if not s.get("hidden")]
    if not steps:
        return None
    ratio = sum(1 for s in steps if s.get("status") == "verified") / len(steps)
    if ratio >= 0.7:
        return "high"
    if ratio >= 0.35:
        return "medium"
    return "low"


def visible_step_count(effective: dict) -> int:
    return sum(1 for s in effective.get("steps", []) if not s.get("hidden"))


def build_scenario(effective: dict) -> dict:
    """The full scenario the mint stores: which workflow, its label, the matched archetype,
    and the derived interviewer objectives. persona_key is guaranteed in CAST_KEYS."""
    persona_key = match_archetype(effective.get("department"))
    assert persona_key in CAST_KEYS  # invariant: the map only ever yields real cast keys
    return {
        "workflow_id": effective["workflow_id"],
        "label": effective.get("name") or "this workflow",
        "persona_key": persona_key,
        "objectives": derive_objectives(effective, confidence_of(effective)),
    }
