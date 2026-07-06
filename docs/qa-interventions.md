# QA interventions log

Direct data interventions on the **demo tenant only** (`is_demo = true`, A12), recorded here
because they bypass the product's normal editor/API affordances. Never on a real tenant; each
is a one-off, not a standing pattern.

## 2026-07-06 — remove QA-residue annotation overlay (workflow 82d9372a, bee-goddess-demo)

**Why:** #9 editor live-verify left a QA annotation ("QA-VERIFY annotation: append-only, base
untouched") on step 0 of workflow `82d9372a-4930-4b6d-8bcf-135392766684`. `annotate` overlays are
append-only with no reverse op (correct per ontology rule 1), so it could not be cleared through the
editor. Removed to keep the demo surface clean. Authorized by team-lead (option b, single-row scope).

**Row:** `workflow_step_overlays.id = 174eb957-01f4-49d7-8fc1-7ff7d52a1e5b`
(op=`annotate`, step_id=`83b0b412-20e4-43ea-b131-911357421d09`,
workspace=`fae710e1-f0f1-47ff-a7cd-1572efa3e5ff` / bee-goddess-demo, `is_demo=true` — all confirmed
in one read-only query before deleting).

**Exact statement (parameterized; $1 = the row id above):**
```sql
delete from workflow_step_overlays
where id = $1 and op = 'annotate'
  and workflow_id in (
      select w.id from workflows w
      join workspaces ws on ws.id = w.workspace_id
      where ws.is_demo = true);
```
Result: `DELETE 1`. Post-checks: `/effective` step 0 shows original action, `annotations=0`; the two
manual steps stay soft-hidden; `/history` no longer lists an `annotate` op (8 reversible-op overlays
remain by design). Nothing else moved.

**Follow-up:** the "annotations can't be retracted" gap is logged as a V3 product proposal in
`evals/adjudication/morning-review-packet.md` §5.

## 2026-07-06 — hide the #18 acceptance-test tenant from the picker (qa-acceptance-test)

**Why:** #18 drove the real admin New-Company journey on prod, which creates an
`is_demo=false, is_internal=false` tenant that renders in the workspace picker next to
Bee Goddess. There is no workspace-delete endpoint. Authorized by team-lead (hide via the
product's own `is_internal` scaffolding flag, migration 0007 — not deletion; data preserved
for inspection).

**Target:** `workspaces.slug = 'qa-acceptance-test'` (id `9a792bdc-72aa-42be-863d-5ca2f33843cb`,
`is_demo=false`).

**Exact statement:**
```sql
update workspaces set is_internal = true
where slug = 'qa-acceptance-test' and is_demo = false and is_internal = false;
```
Result: `UPDATE 1`. Post-check: picker query (`is_internal = false`) now returns only
`bee-goddess-demo` (+ a pre-existing `aurora-atelier`, not created by this task). The test
tenant's data (29 claims, 14 snapshot cards) is intact for inspection, just hidden from the
picker. One-off, non-demo test tenant only; never a real client tenant.
