"""Company Report export (F2 "Monday Morning Report" — docs/MARATHON-ORDERS.md, July 8).

One admin button mints a share token; the PUBLIC by-token route composes a print-ready
report AT READ TIME from the same client-visible views the app itself renders (snapshot,
workflows, conflicts, automation opportunities). The share row stores no content, so a
forwarded link always shows the current truth and quarantine keeps holding at the data
layer (every source reads client_visible_claims).

Two deliberate rules:
- Attribution is ROLE-ONLY in the export. A share link travels beyond the room it was
  minted in; speaker names never ride along, even where the in-app surface may show one.
- The payload is versioned ("shape": "company_report.v1") and composed in one function,
  so a future Skills execution can reshape the export without breaking old links.

Mixed auth gate like `sessions`: the mint route requires admin, by-token stays public.
"""

import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_admin
from ..db import get_pool
from ..pipeline import workflow_edit
from .workspaces import automation_opportunities, get_insights, get_snapshot

router = APIRouter()

# ── Trust-tag honesty in export (pilot §3, leak 2) ─────────────────────────────
# A hand-added record is capped CLAIMED internally, but the report rendered it as an
# unlabeled finding — and even spawned a whole exported workflow from one such record —
# so the footer's "findings carry their own confidence levels" promise was untrue. Tags
# never upgrade (non-negotiable #1); this only decides where an honest qualifier is SHOWN.
_TAG_RANK = {None: -1, "SCRAPED": 0, "GUESS": 1, "CLAIMED": 2, "CONFIRMED": 3, "VERIFIED": 4}
_CONFIRMED_RANK = _TAG_RANK["CONFIRMED"]


def _is_unverified(tag) -> bool:
    """A finding is unverified for export when its tag ranks below CONFIRMED (SCRAPED,
    GUESS, CLAIMED, or untagged) — not corroborated through the interviews the report rests
    on. The renderer shows a qualifier so the confidence promise stays true."""
    return _TAG_RANK.get(tag, -1) < _CONFIRMED_RANK


def _records_unverified(tags: list) -> bool:
    """A derived surface (a workflow) is unverified when NONE of the records backing it
    reaches CONFIRMED — e.g. a workflow spawned from a single hand-added CLAIMED record."""
    return not any(_TAG_RANK.get(t, -1) >= _CONFIRMED_RANK for t in tags)


@router.post("/{workspace_id}/share", dependencies=[Depends(require_admin)])
async def mint_share(workspace_id: str):
    """Mint (or return the existing) share link for this workspace's company report.
    Idempotent: one active link per workspace, so "Export" pressed twice gives the same
    URL instead of scattering tokens."""
    pool = await get_pool()
    ws = await pool.fetchval("select 1 from workspaces where id = $1", workspace_id)
    if ws is None:
        raise HTTPException(404, "workspace not found")
    existing = await pool.fetchval(
        "select token from report_shares where workspace_id = $1 and revoked_at is null "
        "order by created_at desc limit 1",
        workspace_id,
    )
    if existing:
        return {"token": existing, "path": f"/r/{existing}"}
    token = secrets.token_urlsafe(24)
    await pool.execute(
        "insert into report_shares (workspace_id, token) values ($1, $2)",
        workspace_id, token,
    )
    return {"token": token, "path": f"/r/{token}"}


def _role_only(side: dict) -> dict:
    """Project a conflict side / finding to role-level attribution for the export."""
    return {"text": side.get("text"), "tag": side.get("tag"), "role": side.get("role")}


# ── Re-identification pass (pilot §3, leak 1) ──────────────────────────────────
# The report already attributes findings by ROLE only. But a role mask is transparent
# in a ten-person company the moment the SAME forwardable page also names a person in a
# finding body, a next step ("owner: Burak"), or a workflow step ("route returns
# questions to Selin"). The rule: role-consistent naming or no names, never both on one
# page. This is a consent-promise enforcement, so it runs at compose time over the whole
# payload — not in the React layer where a name would still travel in the JSON.
#
# We redact every KNOWN person-entity name (and its individual name tokens) for this
# workspace, replacing it with that person's role ("the operations lead") or a neutral
# "a colleague". In a forwardable privacy document it is safer to over-redact a word that
# happens to coincide with a name part than to leak a real name, so the match is
# case-insensitive and covers bare first/last tokens (length ≥ 3) as well as full names.

_NAME_TOKEN = re.compile(r"[^\W\d_]{3,}", re.UNICODE)  # alphabetic runs, ≥3 chars


def _name_variants(canonical: str, aliases: list[str]) -> list[str]:
    """Full names plus their individual name tokens, longest first so a full name is
    redacted before a bare first name could leave a fragment behind."""
    seen: set[str] = set()
    out: list[str] = []
    for full in [canonical, *(aliases or [])]:
        full = (full or "").strip()
        if not full:
            continue
        for candidate in [full, *_NAME_TOKEN.findall(full)]:
            key = candidate.casefold()
            if len(candidate) >= 3 and key not in seen:
                seen.add(key)
                out.append(candidate)
    out.sort(key=len, reverse=True)
    return out


def _redactions(people: list[dict]) -> list[tuple[re.Pattern, str]]:
    """Compile (name-pattern → role-phrase) pairs for every person entity, longest name
    first. Each person's occurrences become their role, or 'a colleague' if role-less."""
    pairs: list[tuple[str, str]] = []
    for e in people:
        role = (e.get("role") or "").strip()
        repl = f"the {role}" if role else "a colleague"
        for variant in _name_variants(e.get("canonical_name") or "", list(e.get("aliases") or [])):
            pairs.append((variant, repl))
    pairs.sort(key=lambda p: len(p[0]), reverse=True)
    return [(re.compile(rf"\b{re.escape(v)}\b", re.IGNORECASE), repl) for v, repl in pairs]


def _scrub(text, redactions: list[tuple[re.Pattern, str]]):
    if not isinstance(text, str) or not text:
        return text
    for pat, repl in redactions:
        text = pat.sub(repl, text)
    return text


def _deidentify(obj, redactions: list[tuple[re.Pattern, str]]):
    """Recursively redact person names from every string in a payload section."""
    if isinstance(obj, str):
        return _scrub(obj, redactions)
    if isinstance(obj, list):
        return [_deidentify(x, redactions) for x in obj]
    if isinstance(obj, dict):
        return {k: _deidentify(v, redactions) for k, v in obj.items()}
    return obj


async def _person_entities(pool, workspace_id: str) -> list[dict]:
    rows = await pool.fetch(
        "select canonical_name, aliases, role from entities "
        "where workspace_id = $1 and entity_type = 'person'",
        workspace_id,
    )
    return [dict(r) for r in rows]


@router.get("/by-token/{token}")
async def report_by_token(token: str):
    """Compose the shareable Company Report. Public: the bearer of the link is the
    audience the admin chose. Reads only client-visible views; role-only attribution."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """select r.workspace_id, w.name, w.industry, w.config
           from report_shares r join workspaces w on w.id = r.workspace_id
           where r.token = $1 and r.revoked_at is null""",
        token,
    )
    if row is None:
        raise HTTPException(404, "unknown or revoked report link")
    workspace_id = str(row["workspace_id"])

    snapshot = await get_snapshot(workspace_id)
    insights = await get_insights(workspace_id)
    opportunities = await automation_opportunities(workspace_id)
    redactions = _redactions(await _person_entities(pool, workspace_id))

    wf_rows = await pool.fetch(
        "select id, name from workflows where workspace_id = $1 order by created_at",
        workspace_id,
    )
    workflows = []
    for wf in wf_rows:
        effective = await workflow_edit.effective_workflow(pool, str(wf["id"]))
        visible = [s for s in effective["steps"] if not s["hidden"]]
        steps = [
            {"index": s["index"], "title": s["title"], "action": s["action"],
             "tool": s["tool"], "status": s["status"]}
            for s in visible
        ]
        if steps:
            # A workflow inherits the confidence of the records it rests on: if none of its
            # backing claims reaches CONFIRMED (e.g. spawned from one CLAIMED record), the
            # export must qualify it, not present it as an established process (leak 2).
            claim_ids = [cid for s in visible for cid in s.get("claim_ids", [])]
            tags = []
            if claim_ids:
                tag_rows = await pool.fetch(
                    "select tag from client_visible_claims where id = any($1::uuid[])",
                    claim_ids,
                )
                tags = [r["tag"] for r in tag_rows]
            workflows.append({
                "name": effective["name"], "steps": steps,
                "unverified": _records_unverified(tags),
            })

    # Gaps: cross-interview conflicts + perception gaps, role-only sides.
    gaps = [
        {"kind": c["kind"], "status": c["status"], "note": c["note"],
         "a": _role_only(c["a"]), "b": _role_only(c["b"])}
        for c in insights["conflicts"]
    ]

    # Opportunities keep their honest-ROI object; internal ids stay behind.
    opps = [
        {"title": o["title"], "summary": o["summary"], "signals": o["signals"],
         "roi": o["roi"]}
        for o in opportunities
    ]

    # Next steps, in the order a Monday morning wants them: what to investigate next
    # (the renderer's own open areas), the admissions that seed the next round's
    # objectives, and who to talk to next. Derived, not stored — stays current.
    next_steps: list[dict] = []
    for card in snapshot:
        if card["card_type"] == "area_to_investigate":
            title = (card["content"] or {}).get("title")
            if title:
                next_steps.append({"kind": "investigate", "text": title})
    for adm in insights["admissions"]:
        if adm.get("objective"):
            next_steps.append({"kind": "follow_up", "text": adm["objective"]})
    # Who to talk to next — by ROLE, never by name (leak 1). If a suggested person has no
    # role to stand in for the name, fall back to a bare count so no name ever ships.
    suggested = [(card["content"] or {}) for card in snapshot
                 if card["card_type"] == "suggested_person"]
    roles = [(c.get("role") or "").strip() for c in suggested]
    if suggested:
        if all(roles):
            who = ", ".join(f"the {r}" for r in roles[:5])
            next_steps.append({"kind": "interview", "text": f"Schedule interviews with {who}"})
        else:
            n = len(suggested)
            next_steps.append({
                "kind": "interview",
                "text": f"Schedule the {n} suggested interview{'s' if n != 1 else ''}",
            })

    findings = [
        {"text": f["text"], "band": f["band"], "tag": f["tag"],
         "mention_count": f["mention_count"], "role": f["role"],
         "unverified": _is_unverified(f["tag"])}
        for f in insights["key_findings"]
    ]

    return {
        "shape": "company_report.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "company": {
            "name": row["name"],
            "industry": row["industry"],
        },
        "stats": insights["stats"],
        # Every content section is de-identified as the last compose step: role-consistent
        # naming or no names, never both on one forwardable page (pilot §3, leak 1).
        "snapshot": _deidentify(snapshot, redactions),
        "key_findings": _deidentify(findings, redactions),
        "workflows": _deidentify(workflows, redactions),
        "gaps": _deidentify(gaps, redactions),
        "opportunities": _deidentify(opps, redactions),
        "next_steps": _deidentify(next_steps, redactions),
    }
