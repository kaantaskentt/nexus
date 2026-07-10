# SIMPLIFY seam-1 — deploy + prod verify

Deployed commit: **fb44c54** (origin/main). Scope = the 8 SIMPLIFY commits (voice fallback,
D copy 0123f83/0584b7d, reorder 223e8b0, delete-preview 1009b30, done-page 1f76fce, inert
cascade fb44c54, responsive AppShell 4f980c3). Pinned once; J/C/K1 deliberately excluded.

## Pin / pre-flight
- Pre-check: prod /health ok, /health/deep ok (0 failed / 0 queued / 0 running) BEFORE deploy.
- Blocker caught pre-deploy: origin/main was missing 3 scoped commits (delete-preview,
  done-page, inert cascade) — they were unpushed. Lead pushed them; origin/main == fb44c54
  verified (contains exactly the 8 scoped commits, none of the J/C/K lanes).

## Migration
- 0022_workspace_sort_order.sql applied BY HAND to live Supabase (pooler, statement_cache_size=0).
  Path corrected from brief: backend/db/migrations/0022_workspace_sort_order.sql.
  Verified: `workspaces.sort_order` now present — integer, nullable, no default; absent before.

## Deploys (from clean worktree at fb44c54)
- Railway nexus-api: SUCCESS (deployment edf73f21).
- Railway nexus-worker: SUCCESS (deployment 51c83132).
- Vercel production: READY (dpl_AbBUyGFJa9ALTHwm4RyP68ipkBVH), aliased nexus-v2-alpha.vercel.app.
- Post-deploy: /health ok, /health/deep ok (0/0/0), /login 200.

## 6a — Picker (desktop 1440)
- Rows draggable: PASS (drag handles present; drag executed).
- Order persists after reload: PASS — dragged Time PR above 1% Session, reloaded, order held
  (proves the sort_order migration end-to-end).
- Prod order restored to as-found: PASS — reset sort_order to NULL for the 5 touched rows
  (pristine pre-drag state); reload shows original hero=marmara-hotel, other=[1-session,
  time-pr, aurora-atelier, bee-goddess-demo].
- Trash affordance present: PASS (per-row Delete button).
- Delete dialog: PASS — opens with EXACT counts on data-rich tenant (Bee Goddess: 19 interviews,
  60 records, 8 conflict findings, 3 workflow maps, 4 mapped people, Its Company Snapshot);
  empty tenant (1% Session) correctly shows no counts. Delete button DISABLED; microcopy
  "Awaiting final confirmation of delete semantics"; type-to-confirm input present. Flag off.
- Hero unchanged: PASS (marmara-hotel, the prepared workspace).

## 6b — Mobile shell at true 390 (device zoom 0.5 compensated → requested 195px)
- Home: PASS — sidebar hidden, "Open navigation" hamburger opens drawer with full nav
  (Home/Interviews/Workflows/Company Context/Insights/Simulations/Settings/Trust), main
  full-width (390, left 0), scrollWidth 390 (measured via JS, no horizontal overflow).
- Interviews: PASS — scrollWidth 390, sidebar hidden, hamburger present, full-width.
- Plan detail (/plans): PASS — scrollWidth 390, sidebar hidden, hamburger present, full-width.
- Desktop unchanged at 1440: PASS — sidebar visible (236px), no hamburger, scrollWidth 1440.

## 6c — D copy
- Employee consent (pending bee-goddess token): PASS — byte-unchanged Emre-primary promise
  ("A quick, honest conversation about your work"; "shared by role, like 'someone in
  operations,' not by your name"; "Nothing is quoted with your name on it"; "You won't be
  asked to rate anyone"; "not a performance review"; CTA "I'm ready, start the conversation").
  NO leadership-copy leakage.
- Leadership context DONE-page / SIMPLIFY G (Atlas Courier context token): PASS — "BETA ·
  CONTEXT CALL" label, gate promise ("You'll see it before anyone on your team is
  interviewed"), "View company snapshot" deep-links to /w/atlas-courier-beta-test/home
  (slug-only). No role-only leakage.
- Leadership pre-call CONSENT welcome copy: NOT RENDERED on prod — the only Atlas context
  session is status=completed (renders the done-page, not the consent gate); there is NO
  pending context session anywhere and creating/resetting one is out of scope. Compensating
  evidence: live API serves context_call=True for the Atlas token (the exact branch signal),
  and deployed fb44c54 source + consent-copy.test.ts pin the leadership strings (headline
  "A working conversation about ...", "attributed to you as its source", gate line, "Begin
  the context call"). Flagged to lead — data-state gap, not a deploy defect.
- Gate-line note (lead confirmed): fb44c54 carries the EARLIER gate line "You will see the
  snapshot before anyone on your team is interviewed"; the amendment to "no one on your team
  is contacted without your explicit approval" is 51d36ae, which landed AFTER this pin and
  rides seam 2 — so the earlier line is EXPECTED here, NOT a 6c failure. Live-corroborated:
  the Atlas done-page rendered the old language ("You'll see it before anyone on your team is
  interviewed"), confirming this deploy is pre-51d36ae.

## 6d — Voice
- Not exercised (per brief: no call started; silence-timeout config was GET-verified live earlier).

## devicePixelRatio note
- Playwright profile carried a 0.5 page zoom (known gotcha). All viewport widths verified via
  JS (window.innerWidth / documentElement.scrollWidth), not screenshots; mobile requested at
  195px to yield a true 390 CSS viewport, desktop at 720px to yield 1440.
