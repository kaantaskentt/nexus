# SIMPLIFY PARK — July 9 ~22:45 PDT (monthly spend limit hit; ALL lanes dead)

**UNBLOCK (Kaan, one action): raise the limit at claude.ai/settings/usage.** Watchtower
resumes lanes after. This file is the exact resume state.

## ⚠️ THE ONE DANGEROUS FACT
**ADDENDUM 3.1 P1 IS NOT FIXED: the LiveRoom VOICE transcript is FROZEN on prod**
(session 5716e93e class — turns store in the DB but the screen sticks on the opener).
**Emre must NOT voice-test until this is fixed and deployed**, or he should be told the
transcript won't render live (the call itself works; the record is intact server-side).
Text mode is unaffected. Resume step 1 below fixes it.

**UPDATE (post-park, two lanes survived): ROOT CAUSE DIAGNOSED (lane-shell, high
confidence).** The VAPI assistants declare `serverMessages` (webhook → DB, works) but NO
`clientMessages` allow-list, so the browser SDK receives zero transcript events; the
July 9 silence-timeout re-provision (16a2614) is when it broke. Fix owned by seam-1
end-to-end: add `"clientMessages": ["transcript","status-update","speech-update"]` in
vapi_assistant.py + provision_vapi.py, re-provision BOTH shared assistants with the
shared-secret guard (GET-verify clientMessages + auth + silence=60 + ryan/stopSpeaking
untouched), verify via headless call (assistant-speaks-first → its opener must render
as on-screen turns), then round-2 bundle deploy (+ bea9fac; Railway included since
vapi_assistant.py is backend). lane-shell's poll-backfill defense = follow-up proposal
for lane-e, NOT in this seam (dedupe unverifiable without a driven call).

## Where prod is RIGHT NOW (all verified green at seams 1-4)
- Prod = b718074 (Vercel) / c92ba85 (Railway). Migrations 0022/0023/0024 applied.
- LIVE + verified: reorder, delete preview (destructive gated OFF pending Kaan §6-1),
  CEO welcome/done copy, SnapshotIntro + regrouped snapshot, Workflows chips+detail+
  backfill, staged interview hub (K1-K6), responsive mobile shell, LiveRoom with
  Captured-live (TEXT verified; VOICE transcript frozen — the P1), sim scenarios with
  persistent SIMULATION marker, prompt caching (13k→3 warm tokens), 60s silence fix.
- Pushed but NOT deployed: bea9fac (sim consent copy), 2026f50 (intake prompt seed —
  needs migration 0025 at next seam), 96b4580 (IA pre-review), c02c14c+ logs.

## RESUME QUEUE (in order)
1. **lane-e: P1 transcript fix** (ADDENDUM 3.1; brief in GO-LANE-E.md + task #15).
   Then seam-4 round-2 (seam-1 has the locked runbook: bundle bea9fac + fix, check
   backend files in delta, deploy, drive REAL voice turns to verify, tear down orphan
   roleplay 78d704f4 on bee-goddess).
2. **lane-dbg: Snapshot v2** (ADD-3.2, task #16) — WIP preserved on branch
   `park/simplify-wip` (SnapshotView.tsx mid-edit + tailwind tokens; may not compile).
3. **lane-shell: IA consolidation** (ADD-3.3, task #17) — pre-review committed 96b4580,
   build not started.
4. **lane-k: intake agent** (ADD-4, task #18) — commit 1/4 landed (2026f50, prompt +
   seat + migration 0025 NOT applied to live). Commits 2-5 remain (endpoint, UI intake
   phase reusing K3 applied-changes, required fields, evals).
5. **audit-walk: driven re-walk** (ADD-3.4, task #19) — checklist committed 016e43a;
   starts AFTER seam-4-round-2; rules agreed (QA Refine (internal) disposable tenant;
   delete-company cascade LOCAL only).
6. **23:45 lanes** (ADD-5): code-map = code-cleaner (scope agreed; F21 staged patch
   evals/adjudication/staged/29-*.patch is OFF-LIMITS — awaiting Emre ratification);
   lane-a = stress tests (writes on local/hidden only); lane-design = token batch then
   screenshots (hit list ready: --surface-dark, title scale 2.75rem, --step--2 label
   utility; SnapshotView LAST after v2 lands). Figma/Canva MCP need Kaan's /mcp auth
   in the design lane's session (relayed, non-blocking).
7. **ADD-6 SAFETY-CRITICAL** (task #21): Emre Section 7 imminent-harm doc still NOT
   extracted (docs/emre-inbox/section7-media/ empty). The moment it lands: dedicated
   careful lane, A24 classification per point, sealed-flag/gate touches flagged to
   Kaan+Emre, clear-ADOPTs built. Highest care.

## Kaan's open decision list (unchanged, batched)
§6-1 delete-company cascade enable (2 env flags after nod) · §6-2 CEO copy wording pass
(shipped, polish invited) · plan-chat live-diff depth (bounded version shipped) ·
naming table (Agent Skills→Playbooks headline) · picker hero drag (shipped non-drag,
protects P5 guard) · J premium polish + explicit persona "goals" section · Insights
fold = CONFIRMED by Kaan (ADD-3.3 building it).

## Process lessons this sprint (for tasks/lessons.md + memory at close)
- Shared-tree: file-scoped commits can still break HEAD via cross-lane DEPENDENCIES
  (b2e8c7a imported a not-yet-committed module). Sequence entangled files via patch
  extraction (the code-map/lane-e procedure worked).
- Teammate mailboxes drop messages under load; a repo file (GO-LANE-E.md pattern) is
  the reliable channel. Watchtower relays land as "addendum" copies — dedupe by content.
- origin/main diverges when seam runners push from worktrees while lanes commit locally:
  MERGE (never rebase — hash stability), then push.
- A dry-run of a non-deterministic (LLM) writer is not a review; plan/apply split
  (0e9d1e3) is the pattern.
- Measurement walks miss what only DRIVEN flows catch (the transcript freeze) — every
  future verify pass must drive at least one real call.
