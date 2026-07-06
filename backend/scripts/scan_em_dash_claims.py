"""Read-only guard: report claim_records whose AUTHORED claim_text carries an em-dash.

The compiler's `claim_text` renders straight to client-facing surfaces (Snapshot / Insights /
Knowledge Base), where an em-dash reads as an AI tell. The source fix is the compiler prompt
(stage4-compiler.md hard rule 7) + the golden-compiler assertion; this script is the RUNTIME
check for tenants that were compiled BEFORE the fix. It never edits anything — never strip at
render or in place (that corrupts records). The remedy for hits is to RE-COMPILE the offending
sessions with the fixed prompt. evidence_quote is verbatim and intentionally NOT scanned.

Usage (point DATABASE_URL at the tenant's DB; live is the pooler, container is :55432):
    python -m scripts.scan_em_dash_claims            # all workspaces
    python -m scripts.scan_em_dash_claims <slug>     # one workspace by slug
Exit 1 if any hit, so it can gate a post-deploy verify (task #20).
"""

import asyncio
import sys

from app.db import get_pool


async def main() -> int:
    slug = sys.argv[1] if len(sys.argv) > 1 else None
    pool = await get_pool()
    q = (
        "select w.slug, w.is_demo, c.id, c.claim_text "
        "from claim_records c join workspaces w on w.id = c.workspace_id "
        "where c.claim_text like '%—%'"
    )
    rows = await pool.fetch(q + (" and w.slug = $1" if slug else ""), *([slug] if slug else []))
    if not rows:
        print(f"ok: no em-dash in claim_text ({'slug=' + slug if slug else 'all workspaces'})")
        return 0
    print(f"FAIL: {len(rows)} claim_records carry an em-dash in claim_text (re-compile their sessions):")
    for r in rows:
        print(f"  [{r['slug']}{' demo' if r['is_demo'] else ''}] {r['id']}: {r['claim_text'][:90]}")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
