# SIMPLIFY seam-2 — deploy + prod verify

Deployed commit: **49fde3f** (origin/main, a merge = seam-1 logs + full seam-2 payload).
Contains lane-e (d4140fb/ff60beb/efa9702/8c3203b/a1d169c/0ac212c/45da288), K4 (f30c891/c1773fe),
K5/K6 (feee0b2), D amendment (51d36ae), lane-c workflows+backfill (bfe7c11), caching (90c64d0),
voice fallback (2b69513), migrations 0023/0024, design-only Simulations doc (8c4ad5e).

## Pin / pre-flight
- Pre-check green: /health ok, /health/deep 0/0/0.
- Blocker caught pre-deploy (mirrors seam-1): seam-2 payload was on LOCAL main, unpushed;
  origin/main still at seam-1 log. Lead merged local→origin (kept hashes stable) → 49fde3f.
  Verified pin contains all cargo; nothing out-of-scope.

## Migrations (in order, before backend deploy)
- 0023_workflow_taxonomy applied by hand (pooler, statement_cache_size=0): workflows.department
  + workflows.description columns present (were absent). This unblocks the Workflows page (else 500).
- 0024_live_captures applied: live_captures table present (9 cols) + live_capture_extractor
  agent_config row inserted. Verified.

## Backfill (review-gated)
- backend/scripts/backfill_workflow_taxonomy.py — LLM-based + NON-DETERMINISTIC (dry-run and
  --apply gave different dept/description for the same rows). Reviewed the APPLY output itself.
- bee-goddess-demo APPLIED: confident-only + sound — 'Weekly Boutique Stock Count' → Operations;
  'Daily Gold Repricing' + 'Daily Repricing & Online Order Fulfilment' → dept null (under "All");
  all three with accurate descriptions. Persisted state confirmed. (Intended PERMANENT write.)
- time-pr — initially HELD on a questionable call (two identically-named 'Morning Media Digest'
  rows, one → null, one → 'Marketing', a shaky internal bucket for a PR agency). RESOLVED via
  lane-a's new plan/apply split (post-pin, script-only pull): `--plan` reran the classifier
  (Marketing reappeared, confirming the non-determinism), edited the plan to null EVERY
  department while keeping descriptions per lead ruling, `--apply` wrote exactly those rows
  (zero new LLM calls). Final: all 3 time-pr workflows dept=null (under "All") + accurate
  descriptions. workflow_ids 049014eb / 8ad4bc87 / 2deacfb9. Intended PERMANENT write.
- Non-determinism flagged → lead assigned the plan/apply split (landed as 0e9d1e3); used here
  for time-pr so the reviewed pre-image is byte-for-byte what lands.

## Deploy (clean worktree @ 49fde3f)
- Railway nexus-api SUCCESS (df54c909), nexus-worker SUCCESS (e7af9344).
- Vercel prod READY (dpl_8tCqeLANnTN2LdE167F3xXWDiFtt), aliased nexus-v2-alpha.
- Post-deploy: /health ok, /health/deep 0/0/0, /login 200.

## Browser verify (desktop 1440 + mobile 390; JS-measured, 0.5-zoom compensated 720/195)

### PASS (desktop)
- Workflows chips + detail (bee-goddess): loads (no 500 — 0023 good). Department chips "All"/
  "Operations" render; cards show backfilled descriptions; derived confidence badges (Low/High,
  read-time from verified-step ratio, not stored); Operations chip filters to the one Ops
  workflow; detail page renders (steps, description, no overflow).
- Interviews staged hub: unified plan/observe/report/follow-up, stage cards + counts, New interview → /interviews/new.
- /interviews/new assign flow (K3): one screen — Name / Role / What-should-this-find-out +
  "Draft interview plan"; gate promise "waits for your approval before anything reaches the person".
- Plan detail (K1): "Interview Plan", stage rail, Awaiting approval, Company card, Goal +
  topic-grouped questions, approve/gate footer.
- Observe (K4): staged view, transcript area, LIVE NOTES with trust-ladder note (live = Reported only).
- Report (K5): "Post-Interview Report" (admin-only), findings-first, stage rail, Follow-up a real stage.
- SnapshotIntro (B): "Company snapshot ready" + stats + grouped preview → "View company snapshot".
- Regrouped SnapshotView: Overview / Teams & People / Open questions / Evidence with real cards,
  Export action, source attribution. (Restored bee-goddess config.snapshot_intro_seen to absent afterward.)
- Leadership PRE-CALL welcome LIVE (closes seam-1 gap): minted a disposable pending context
  session on Atlas Courier (is_internal), rendered /i/<token>. Verified: headline "A working
  conversation about Atlas Courier (beta test)"; AMENDED D gate line "the snapshot is yours to
  review first, and no one on your team is contacted without your explicit approval" (51d36ae —
  old line absent); "attributed to you as its source"; "Nothing you say here is ever repeated to
  an employee"; CTA "Begin the context call"; NO role-only leakage. Screenshot captured.
- Live room + Captured-live panel (E), TEXT mode: room renders "Voice off · Text mode / Listening",
  Pause/Finish/Switch-to-voice, transcript, text input, and the Captured-live panel showing REAL
  extracted items (from 2 driven text turns): [system] Dispatch board, [workflow] Route assignments
  (closed-kind set, no sentiment — non-negotiable #4 held).
- Caching (90c64d0) PROVEN via agent_runs on the minted session: turn 1 cache_write=6636/read=0
  (cold), turn 2 cache_write=0/cache_read=6636 (WARM hit). Live-capture extractor also fired off
  the text turn (45da288) — agent_runs turn 3 = live_capture_extractor, status ok.
- Disposable Atlas session TORN DOWN: deleted utterances(3)/agent_runs(3)/live_captures(2)/session(1);
  zero rows remain; Atlas left with only its original completed context session.

### PASS (mobile 390, true viewport)
- Workflows, Interviews hub, Live room (text): scrollWidth == 390, sidebar hidden, hamburger present, no overflow.

### FAIL (mobile 390) — ONE ISSUE
- **StageRail horizontal overflow.** The Plan/Observe/Report/Follow-up horizontal stepper does not
  fit at 390: Plan detail (K1) scrollWidth 409 (+19px), Report (K5) scrollWidth 417 (+27px, rail +
  the fixed-width 15.5rem coverage-step card carousel). Culprit element: the rail's last step
  ("4 Follow-up", `div.flex flex-1 items-center last:flex-none`) extends to right=409. Isolated to
  the two pages that render the full-width StageRail; the Interviews hub (per-card badges) is fine.
  Desktop 1440 unaffected. Function not broken — 19-27px of horizontal scroll only.
  Recommended fix (lane-k): let the rail wrap or `overflow-x-auto` + shrink labels below sm; and
  wrap the Report coverage-card row in an `overflow-x-auto` scroller with `min-w-0`.
  RESOLUTION (lead): FIX-NOW — lane-k is building the fix, but it does NOT get its own redeploy;
  it rides SEAM-3 (final fixup deploy). So this stays live-on-prod at 49fde3f until seam-3 ships.

## Not exercised
- Voice: no voice call started (per brief). Text mode + silence-timeout config unchanged.
