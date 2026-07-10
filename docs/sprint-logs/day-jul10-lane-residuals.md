# LANE-RESIDUALS — day-jul10 (R5: ship what didn't ship)

**Reassignment:** this lane is run by the former lane-export teammate (lane-export closed —
6 commits on main, seam-B verify handed off). Team-lead reassigned to LANE-RESIDUALS wave 4.
Ownership rows retained from lane-export: company_report.py, frontend/src/app/r/**,
evals/adjudication/**, conflicts.py, perception-gap.md, ExportReportButton.tsx (owner of
record for seam-B fix-ups if driven verify finds a leak-class failure).

Law: A28 gate on every BUILD change (two-line pre-review + own revertable commit) · read-only
items get a verdict, not a commit · I DEPLOY nothing and APPLY no migration (team-lead holds
seams) · announce before touching another lane's files (quality: glossary + personas; split:
components/interview/**).

Base HEAD at start: 88c8fb6.

---

## Item 1 — parked-payload deploy status (READ-ONLY; team-lead folds into seam-B)

Method note: there is NO version/commit-SHA endpoint on prod (`/health` returns only the
product name; `/health/deep` returns queue vitals). A literal deployed-hash comparison needs
the Railway/Vercel deploy state team-lead controls, so this is a repo-side state inventory —
definitive for "pushed" and "migration parked"; team-lead confirms against the live deploy.

| Payload | What it is | Pushed? | Migration | Pending for it to be live |
|---|---|---|---|---|
| **bea9fac** | SIMPLIFY I — simulation consent copy (frontend `respondent.ts` + a test) | YES, in main | none | a Vercel (frontend) deploy carries it. No DB dependency. |
| **2026f50** | ADD-4 — new-interview intake agent prompt (`intake-interviewer.md`) + **migration 0025_intake_agent.sql** (seeds the `intake_interviewer` agent_config, strong seat) | YES, in main | **0025 PARKED** — not in conftest.MIGRATIONS, not applied to the test container (conftest line 48 comment confirms), presumed not applied to live | apply 0025 to the live DB **then** backend deploy; feature stays behind `NEXT_PUBLIC_INTAKE_ENABLED` (used in AssignInterviewFlow.tsx + live.ts) |
| **96b4580** | ADD-3.3 — IA consolidation *proposal* (docs only: simplify-lane-shell.md) | YES, in main | none | NOTHING to deploy — it is a proposal doc, not a runtime payload. "Deployed" is N/A; it is a decision for Kaan/team-lead, not a ship. |

**Seam-B migration order (numeric, before backend deploy):** `0025_intake_agent.sql` (parked
intake seed) → `0026_harm_incidents.sql` (lane-s7's, already in conftest). Both pending on live.
0026 is lane-s7's to own; I only flag the ordering.

**Offer:** I can run a read-only live confirmation (Supabase MCP `list_migrations` +
`select count(*) from agent_configs where agent_name='intake_interviewer'`) if team-lead wants
it — I have not, to avoid touching the live tenant without the nod (prod verification is your
seam). Say the word.

**VERDICT (item 1):** bea9fac = deploy-pending (frontend, no migration). 2026f50 =
deploy-pending AND migration-0025-pending (parked). 96b4580 = not a shippable payload (docs
proposal). Nothing here needs a lane-residuals commit; all three are seam-B/team-lead actions.

---

## Item 2 — automation-opportunities orphan check (READ-ONLY; NOT orphaned)

Traced the full render path. The surface is **not orphaned** — opportunities have a correct
canonical home and a report home:
- **Home** (`app/w/[slug]/home/page.tsx`) fetches `get_automation` and passes it to
  `SnapshotView`, which renders `<Section title="Automation opportunities">` → `OpportunityCard`
  when `automation.length > 0` (SnapshotView.tsx:327). Comment confirms the ADD-3.3 fold: "key
  findings + automation opportunities now render on Home, their one canonical surface."
- **Report** (`r/[token]`) renders its own Automation-opportunities section when non-empty.
- Nav: Insights left the nav (folded into Home); a stale `/insights` link lights Home
  (AppShell NAV_ALIAS). No dangling surface.

Why they were "not sighted" in the pilot (pilot §8) — upstream data, not a redesign orphan:
1. `assess_automation` is enqueued INSIDE compile (compiler.py:360, after conflicts), so
   automation rows only ever exist alongside snapshot cards. On **test-mest the snapshot never
   composed** (lane-mest's compile bug) → Home short-circuits to `DiscoveryUpload` when
   `cards.length === 0` (home/page.tsx:57), so SnapshotView never mounts and nothing renders,
   opportunities included. Fixing that is lane-mest's compile fix, not this surface.
2. The actual backend bar (automation.py) is: cite ≥1 valid record + non-empty title/summary.
   There is **no two-signal minimum** on automation — Emre's "two-signal evidence bar"
   hypothesis conflates the attention/fade rule (attention.py, `>=2` fade signals) with
   automation. A thin/absent compile simply yields no assessor rows.

**VERDICT (item 2):** NOT orphaned; no fix to build. Home + report render correctly, gated on
non-empty. Recommend a driven RE-CHECK on a data-bearing tenant AFTER lane-mest's compile fix
(test-mest recompiles → snapshot + assessor rows → cards appear on Home). That recheck is a
prod driven flow → team-lead seam checklist (see item-4 prep below). No lane-residuals commit.

## Item 3 — Marmara Hotel thin-compile (1 record / 1 person / 1 area)

"Marmara Hotels Taksim" is a **real prospect** (MERGE_PLAN.md L197), not a repo fixture (eval
fixtures use fictional names; the `Marmara Hotels Taksim` string in test_workspaces.py is a
unit-test name, not the compiled prospect data). A manual look means inspecting a real client's
compiled records on the **live tenant** — that is team-lead's prod seam, and reading a real
client transcript is sensitive, so I am NOT querying it unilaterally.

Prepared read-only checks for team-lead's seam (or my run on your nod) — the question is
whether 1/1/1 is a genuine thin call or a compile that dropped records:
1. `select count(*) from claim_records where workspace_id=$M` vs
   `select count(*) from client_visible_claims where workspace_id=$M` — a large gap = records
   captured but quarantined/filtered down (extraction or view issue), not a thin call.
2. Session transcript length for the Marmara discovery session — a substantive transcript that
   yielded 1 record points at an extraction hiccup (cf. lane-mest's renderer-parse/credit
   finding); a 1-exchange transcript is legitimately thin.
3. `select status, count(*) from jobs where ... workspace=$M group by status` — any failed /
   partial compile job on that workspace.
4. Snapshot-card count + card_types (the "1 area").
**VERDICT (item 3):** cannot manually look read-only without live-tenant access; steps above
are on the team-lead seam checklist. Interpretation rule: gap between claim_records and
client_visible_claims OR a long transcript ⇒ suspicious compile (escalate to lane-mest class);
short single-exchange transcript ⇒ legitimately thin, safe.

## Item 4 — walk residuals (component checks done; driven passes → team-lead seam)

Component/static verification I could do locally:
- **opportunity→workflow deep-link — CORRECT.** OpportunityCard (SnapshotView.tsx:53-58) renders
  "See it in the workflow" ONLY when `o.workflow_id && workflowIds.includes(o.workflow_id)` —
  guards against a link into the void (Kaan P1); links to
  `/w/{slug}/workflow/{id}?from=home&highlight={step_ids}`; falls back to inline evidence when
  the workflow is gone. Report surface has its own non-empty guard. No fix needed. The only
  open piece is a DRIVEN check that `?highlight=` lands on the right steps on a data-bearing
  tenant → team-lead seam.

Prod DRIVEN passes for team-lead's seam checklist (I cannot drive prod; exact flows):
- roleplay text-from-start re-check · fold surfaces detail pass · K hub end-to-end · intake
  live-diff re-confirm (needs 0025 applied first — see item 1) · D welcome / J card driven
  pass · QA Refine DiscoveryUpload seed + Feedback-B re-verify · opportunity→workflow
  highlight on a data-bearing tenant · **the item-2 recheck** (post-mest-compile: test-mest
  snapshot composes → opportunity cards appear on Home).
**VERDICT (item 4):** deep-link wiring verified correct at component level; all remaining
items are prod driven flows on the team-lead checklist. No lane-residuals commit.

## Item 5 — plan-detail right void + stat-chip labeling (DESIGN PROPOSAL → Kaan)

Structural read: PlanView (components/plan/PlanView.tsx) uses `max-w-6xl` + `lg:grid-cols-2`
(L192/L294). The two-column grid leaves a tall empty RIGHT void on large screens once the plan
body fills the left column and the right holds only the short action/report block. A28 says
propose, don't rebuild an existing feature's layout, and this is taste → Kaan session, not a
unilateral build. Options for the Kaan design pass:
- **A (recommended):** collapse to a single centered reading column (`max-w-3xl`, matching the
  report/snapshot convention) + a sticky bottom action bar — removes the void by not creating a
  second column.
- **B:** keep two columns but make the right a STICKY rail (goal summary + approve/send +
  report link) that stays in view as the left scrolls — fills the void with persistent utility.
- **C:** rebalance plan sections across both columns.
Stat-chip labeling: flagged for the same pass — needs the specific unlabeled chips identified
and a labeling convention decided (Kaan). **VERDICT (item 5):** proposal above, taste-gated,
FLAGGED for a Kaan design session. No build.

## Item 6 — Trust Center invite-email consent sync (BLOCKED — precondition unmet)

Precondition is "once the locked-copy change lands." CEO-consent final wording is STILL in the
human-gated list (DAY-ORDERS L247 + KAAN-RULINGS L41, awaiting Kaan+Emre). The locked copy has
not landed, so the invite-email→canonical-consent sync cannot be verified or built yet.
**VERDICT (item 6):** blocked on human-gated CEO-consent wording; re-open when that lands.

## Build/verdict log
- item 1 (parked payloads) — READ-ONLY inventory, no commit. bea9fac + 2026f50 deploy-pending
  (2026f50 also needs parked migration 0025); 96b4580 is a docs proposal, not a payload.
- item 2 (automation orphan) — READ-ONLY verdict: NOT orphaned (Home+report render correctly,
  gated on non-empty; absence was upstream compile/data), no commit.
- item 3 (Marmara thin-compile) — prod-gated (real prospect); prepared seam read-only steps.
- item 4 (walk residuals) — deep-link verified correct at component level; rest → team-lead
  driven seam checklist.
- item 5 (plan-detail void + stat-chips) — DESIGN PROPOSAL, taste-gated, flagged for Kaan.
- item 6 (trust-center consent sync) — BLOCKED on human-gated CEO-consent wording.

**Lane-residuals outcome:** a full read-only sweep of all six items. None is a safe local
build right now — they are deploy-gated (1), already-correct (2, 4 deep-link), prod-driven (3,
4), taste-gated (5), or human-gated (6). Deliverables: the parked-payload + migration-order
inventory for seam B, the not-orphaned verdict, the Marmara + walk driven scripts for the
team-lead seam checklist, and the plan-detail proposal for a Kaan design session. Zero
speculative commits — matches "careful over fast".
