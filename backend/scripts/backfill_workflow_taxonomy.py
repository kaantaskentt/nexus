"""One-off backfill: derive description + department for workflows that predate the
taxonomy columns (migration 0023). Same confident-only rule as build time — department is
written ONLY when the evidence clearly places the workflow; unclear stays null and renders
under "All". Never guesses.

PLAN/APPLY split (review-protocol fix): the classifier is an LLM call and therefore
NON-DETERMINISTIC, so a dry-run is not a pre-image of an apply — the same rows can classify
differently between two runs, which means a dry-run reviews nothing. Instead:

  1. `--plan out.json` runs the classifier ONCE and writes the exact proposed rows.
  2. A human reviews out.json.
  3. `--apply out.json` writes EXACTLY those reviewed rows with ZERO new LLM calls. It
     refuses (and writes nothing) if the DB drifted since planning: a planned workflow is
     gone, or a column the plan means to fill is no longer null. What you reviewed is
     byte-for-byte what lands.

Only null columns are ever filled — a value the builder already set is never overwritten.

Usage (point DATABASE_URL at the tenant DB; container is :55432, live is the pooler):
    python -m scripts.backfill_workflow_taxonomy --plan plan.json          # all workspaces
    python -m scripts.backfill_workflow_taxonomy <slug> --plan plan.json   # one workspace
    python -m scripts.backfill_workflow_taxonomy --apply plan.json         # write reviewed rows

Do NOT run against live until lane C is reviewed (seam-2 owns live writes tonight).
"""

import asyncio
import json
import sys
from datetime import datetime, timezone

from app.db import get_pool
from app.pipeline.workflow import classify_workflow_taxonomy


class PlanDriftError(Exception):
    """The DB no longer matches the reviewed plan — apply is refused so nothing stale lands."""


async def build_plan(pool, slug: str | None) -> list[dict]:
    """Run the classifier ONCE per candidate workflow and return the exact proposed rows.
    Only rows that would actually write something (a non-null description and/or department)
    are included, so the plan file IS the set of proposed writes. Confident-only holds:
    `classify_workflow_taxonomy` returns a null department when the steps don't place it."""
    rows = await pool.fetch(
        """select w.id, w.name, w.workspace_id, ws.slug
             from workflows w join workspaces ws on ws.id = w.workspace_id
            where (w.description is null or w.department is null)
              and ($1::text is null or ws.slug = $1)
            order by w.created_at""",
        slug,
    )
    plan: list[dict] = []
    for r in rows:
        steps = await pool.fetch(
            "select action, tool, output from workflow_steps where workflow_id = $1 order by step_index",
            r["id"],
        )
        tax = await classify_workflow_taxonomy(
            r["name"], [dict(s) for s in steps], workspace_id=str(r["workspace_id"])
        )
        desc, dept = tax.get("description"), tax.get("department")
        if desc is None and dept is None:
            continue  # unclear on both — nothing to write, so nothing to review
        plan.append({
            "workflow_id": str(r["id"]),
            "slug": r["slug"],
            "name": r["name"],
            "description": desc,
            "department": dept,
        })
    return plan


async def apply_plan(pool, rows: list[dict]) -> dict:
    """Write EXACTLY the reviewed rows, no LLM calls. One transaction: every row is
    validated against the current DB first, and if ANY drifted (workflow gone, or a column
    the plan fills is no longer null) the whole apply is refused via PlanDriftError so a
    partial/stale write can never happen. Only the columns the plan sets are touched, and
    only while they are still null."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            drift: list[str] = []
            for row in rows:
                current = await conn.fetchrow(
                    "select description, department from workflows where id = $1",
                    row["workflow_id"],
                )
                if current is None:
                    drift.append(f"{row['workflow_id']} ({row.get('name')!r}): workflow no longer exists")
                    continue
                if row.get("description") is not None and current["description"] is not None:
                    drift.append(
                        f"{row['workflow_id']} ({row.get('name')!r}): description set since planning")
                if row.get("department") is not None and current["department"] is not None:
                    drift.append(
                        f"{row['workflow_id']} ({row.get('name')!r}): department set since planning")
            if drift:
                raise PlanDriftError(
                    "DB changed since the plan was written; refusing to apply. Re-plan.\n  - "
                    + "\n  - ".join(drift)
                )

            applied = 0
            for row in rows:
                await conn.execute(
                    """update workflows
                          set description = coalesce(description, $2),
                              department  = coalesce(department, $3)
                        where id = $1""",
                    row["workflow_id"], row.get("description"), row.get("department"),
                )
                applied += 1
    return {"applied": applied}


async def main() -> int:
    args = sys.argv[1:]
    slug = next((a for a in args if not a.startswith("--")), None)

    def _opt(name: str) -> str | None:
        if name in args:
            i = args.index(name)
            if i + 1 < len(args) and not args[i + 1].startswith("--"):
                return args[i + 1]
        return None

    plan_path = _opt("--plan")
    apply_path = _opt("--apply")

    if not plan_path and not apply_path:
        print(__doc__)
        print("error: pass --plan <file> to propose rows, or --apply <file> to write them.")
        return 2

    pool = await get_pool()

    if plan_path:
        plan = await build_plan(pool, slug)
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "slug": slug,
            "rows": plan,
        }
        with open(plan_path, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"planned {len(plan)} write(s) -> {plan_path}")
        for row in plan:
            print(f"  [{row['slug']}] {row['name']!r} -> "
                  f"department={row['department']!r} description={row['description']!r}")
        print("Review the file, then run --apply on it to write exactly these rows.")
        return 0

    # apply_path
    with open(apply_path) as f:
        payload = json.load(f)
    rows = payload.get("rows", payload) if isinstance(payload, dict) else payload
    try:
        result = await apply_plan(pool, rows)
    except PlanDriftError as e:
        print(f"REFUSED: {e}")
        return 1
    print(f"applied {result['applied']} reviewed row(s) from {apply_path}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
