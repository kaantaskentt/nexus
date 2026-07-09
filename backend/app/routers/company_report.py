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

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_admin
from ..db import get_pool
from ..pipeline import workflow_edit
from .workspaces import automation_opportunities, get_insights, get_snapshot

router = APIRouter()


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

    wf_rows = await pool.fetch(
        "select id, name from workflows where workspace_id = $1 order by created_at",
        workspace_id,
    )
    workflows = []
    for wf in wf_rows:
        effective = await workflow_edit.effective_workflow(pool, str(wf["id"]))
        steps = [
            {"index": s["index"], "title": s["title"], "action": s["action"],
             "tool": s["tool"], "status": s["status"]}
            for s in effective["steps"] if not s["hidden"]
        ]
        if steps:
            workflows.append({"name": effective["name"], "steps": steps})

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
    pending_people = [
        (card["content"] or {}).get("name")
        for card in snapshot if card["card_type"] == "suggested_person"
    ]
    pending_people = [p for p in pending_people if p]
    if pending_people:
        next_steps.append({
            "kind": "interview",
            "text": "Schedule interviews with " + ", ".join(pending_people[:5]),
        })

    findings = [
        {"text": f["text"], "band": f["band"], "tag": f["tag"],
         "mention_count": f["mention_count"], "role": f["role"]}
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
        "snapshot": snapshot,
        "key_findings": findings,
        "workflows": workflows,
        "gaps": gaps,
        "opportunities": opps,
        "next_steps": next_steps,
    }
