# SIMPLIFY seam-3 — final fixup deploy + prod verify

Deployed commit: **c92ba85** (origin/main). Cargo: StageRail mobile fix (4e42cc8), admin
Captured-live panel (f4e64c6), backfill plan/apply script fix (0e9d1e3), Simulations page half
(a43a58f + f2311f0 backend + 5922451 page), Run-wiring half (3a972a5 backend + a75b853 room marker).

## Pin / pre-flight
- Pin verified: all 8 cargo commits are ancestors of c92ba85. origin/main already carried the
  cargo (no unpushed-payload trap this time).
- NO-MIGRATIONS GUARD: `git diff --name-only 542f6a9..c92ba85 | grep migrations/002` = EMPTY. Confirmed.
- Pre-check: /health ok, /health/deep 0/0/0.

## Deploy (clean worktree @ c92ba85) — no migrations, no backfill
- Railway nexus-api SUCCESS (d33ddaa8), nexus-worker SUCCESS (913ea7c4).
- Vercel prod READY (nexus-v2-22a4lgnht). Post-deploy /health ok, /health/deep 0/0/0, /login 200.

## Verify (desktop 1440 + mobile 390; JS-measured, 0.5-zoom compensated 720/195)

### StageRail mobile overflow — FIXED (the seam-2 regression)
- Plan detail (K1) at true 390: scrollWidth **390** (was 409). PASS.
- Report (K5) at true 390: scrollWidth **390** (was 417); the wide coverage-card carousel now
  scrolls inside its own container (widest child 837 but document stays 390). PASS.
- Desktop 1440 unaffected: Report scrollWidth 1440, stage rail intact.

### Simulations (#10) — REAL new surface, both widths
- Populated tenant (bee-goddess): real workflow yields a scenario card — "Daily Repricing and
  Online Order Fulfilment" + "Daily Gold Repricing" cards with confidence, step counts, Run
  simulation + Play-this-character. Firewall copy present ("Nothing said in a simulation touches
  your company records"). "Runs in this workspace" empty state. No 500, no overflow (1440 & 390).
- Run opens the room: SIMULATION marker present — "Simulation · Daily Repricing and Online Order
  Fulfilment — practice run. Nothing here reaches your company records." — and NO captured-live
  panel in the sim room. PASS. Backend correctly produced ZERO live_captures for the roleplay
  turn (sim doesn't touch records).
- Thin tenant (1-session, 0 workflows): empty state "No workflows to practice against yet …
  None are mapped yet" — NO Run buttons, NO Play-this-character cast. PASS (never the cast).

### Admin Captured-live panel (f4e64c6)
- Verified on a minted bee-goddess interview session (Atlas is is_internal → admin pages 404, so
  used a visible tenant). Drove 2 text turns → 3 live captures. Admin Observe page
  (/w/bee-goddess-demo/interviews/<id>, "Ece · Founder · Text Interview · Live") shows the
  "Captured live" panel: Morning repricing [WORKFLOW], Spreadsheet (repricing) [SYSTEM], Online
  returns queue [WORKFLOW], each with the **REPORTED** badge; footer "Live capture · Reported
  (single source)"; "3 items captured". Structural kinds only, no sentiment (non-neg #4). PASS.

### Regression smoke (seam-2 surfaces)
- Workflows: chips (All/Operations) + backfilled descriptions render, no 500. Interviews hub:
  stages + counts (4 in planning / 4 interviews / 3 completed) unchanged. PASS.

### Script fix (0e9d1e3)
- No runtime surface; validated by live use in seam-2 (time-pr plan/apply).

## Prod data restored
- THREE disposable sessions minted for verification, ALL torn down (utterances/agent_runs/
  live_captures/session deleted, zero rows remain): sim roleplay e4f39d1a (bee), context 9b05028a
  (atlas), interview 1ec42ed5 (bee). No stray active/pending context+roleplay sessions on either
  tenant; interviews-hub counts unchanged.

## Result
Seam-3 GREEN — StageRail regression fixed, Simulations + admin captures land clean, no regressions.
audit-walk's full #12 walk runs behind this report.
