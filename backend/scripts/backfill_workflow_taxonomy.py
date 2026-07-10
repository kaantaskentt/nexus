"""One-off backfill: derive description + department for workflows that predate the
taxonomy columns (migration 0023). Same confident-only rule as build time — department is
written ONLY when the evidence clearly places the workflow; unclear stays null and renders
under "All". Never guesses.

Dry-run by default: it prints what it WOULD write and changes nothing. Pass --apply to
persist. Do NOT run against live until lane C is reviewed.

Usage (point DATABASE_URL at the tenant DB; container is :55432, live is the pooler):
    python -m scripts.backfill_workflow_taxonomy            # dry-run, all workspaces
    python -m scripts.backfill_workflow_taxonomy <slug>     # dry-run, one workspace
    python -m scripts.backfill_workflow_taxonomy <slug> --apply
"""

import asyncio
import sys

from app.db import get_pool
from app.pipeline.workflow import classify_workflow_taxonomy


async def main() -> int:
    args = [a for a in sys.argv[1:]]
    apply = "--apply" in args
    slug = next((a for a in args if not a.startswith("--")), None)

    pool = await get_pool()
    rows = await pool.fetch(
        """select w.id, w.name, w.workspace_id, ws.slug
             from workflows w join workspaces ws on ws.id = w.workspace_id
            where (w.description is null or w.department is null)
              and ($1::text is null or ws.slug = $1)
            order by w.created_at""",
        slug,
    )
    if not rows:
        print(f"ok: no workflows need taxonomy backfill ({'slug=' + slug if slug else 'all'})")
        return 0

    print(f"{len(rows)} workflow(s) to backfill{' (DRY RUN)' if not apply else ''}:")
    for r in rows:
        steps = await pool.fetch(
            "select action, tool, output from workflow_steps where workflow_id = $1 order by step_index",
            r["id"],
        )
        tax = await classify_workflow_taxonomy(
            r["name"], [dict(s) for s in steps], workspace_id=str(r["workspace_id"])
        )
        desc, dept = tax.get("description"), tax.get("department")
        print(f"  [{r['slug']}] {r['name']!r} -> department={dept!r} description={desc!r}")
        if apply and (desc is not None or dept is not None):
            # Only fill columns that are still null — never overwrite a value the builder set.
            await pool.execute(
                """update workflows
                      set description = coalesce(description, $2),
                          department  = coalesce(department, $3)
                    where id = $1""",
                r["id"], desc, dept,
            )
    print("applied." if apply else "dry run — nothing written. Re-run with --apply to persist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
