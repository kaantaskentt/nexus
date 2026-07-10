# SIMPLIFY Phase 3 — system coherence sweep (task #11, audit-walk)

Static sweep of everything changed since a8a9a98 (client-facing strings + prompts +
personas/evals). No deploy needed. Severity: P0 blocks / P1 real / P2 polish.
Mechanical items FIXED as scoped commits; judgment items REPORTED to team-lead.

## Guard status
- **Trust-promise drift guard GREEN**: `python evals/consent_copy_sync.py` → "ok: 18 consent
  promise lines in sync (respondent.ts <-> consent-landing.md)".
- **Jargon leak scan: PASS.** No internal terms (NEXUS_CHECK, spine slots, session kind,
  claim record, raw CLAIMED/CONFIRMED/GUESS tags, context_collector) appear in client-facing
  frontend strings — all hits were code comments.

## FIXED (mechanical, committed)
- **[P2] Em-dashes in 3 client-facing strings** → commit e4ec8cd. Picker awaiting-call meta
  label + both error-boundary messages carried an em-dash (glossary no-em-dash client rule).
  Replaced with sentence breaks. All remaining frontend em-dashes are in code comments.
- **[P1] Stale /plans references** → commit 7569c84. K2 folded the /plans list into
  /interviews and K3 added /interviews/new; peripheral links still named/target the old page:
  - GeneratePlanButton: "the Interview Plans page" copy → "the Interviews page"; href → /interviews.
  - SnapshotView: "View plans" → "View interviews", href → /interviews (drops a redirect hop).
  - InsightsView + not-found: "schedule an interview" → **/interviews/new** (the canonical
    create route — see the P2 finding below on why not ?new=1).
  - Plan DETAIL deep links (/plans/[id]) unchanged and still valid.

## Trust-promise trio (D) — read side by side
Welcome (consent-landing.md context branch + respondent.ts consentCopy) · collector opener
(stage3-context-collector.md) · done page (InterviewClient.tsx context branch). All three
promise the same thing for a context call: Nexus learns how the company works, turns the
call into the first company snapshot (workflows / systems / open questions), does not pitch/
advise/solve/automate, beta honesty, the founder's words build the snapshot attributed to
them. Coherent. One observation (not a defect): the collector opener does not restate the
"attributed to you as its source" line the welcome makes — acceptable (the welcome already
made it; the agent shouldn't over-recite), flagging only for awareness.

## REPORTED (judgment / files locked by an active lane)
- **[P1] Done-page "first version" drift — InterviewClient.tsx:236 (owned by active lane-e).**
  The context-done body ALWAYS says "This becomes **the first version** of your company
  snapshot", but its own CTA correctly branches on `snapshot_exists`
  ("See what's new in your snapshot" for a later call). A later context call therefore
  promises "first version" wrongly. Exact fix: branch the body copy on `snapshot_exists`
  the same way the CTA does (e.g. later → "This updates your company snapshot"). Not fixed
  here because InterviewClient.tsx is lane-e's active file (uncommitted) — hand to lane-e or
  lane-dbg to fold in.
- **[P2] Next-round-question naming inconsistency (amendment 3 — Kaan's fold call).**
  Inventory of what exists today:
  - Snapshot rendered section (SnapshotView): **"Open questions"**
  - Snapshot pre-call preview (DiscoveryUpload): **"Areas to Investigate"** ← mismatches the
    very section it previews (intra-surface bug, safe 1-line fix, recommend aligning to
    "Open questions").
  - Insights (InsightsView): **"Open Questions"** (capital Q — casing differs from snapshot).
  - Report (ReportView): **"Follow Up On"**.
  The cross-surface fold (Open questions vs Follow Up On) is Kaan's per amendment 3; the
  DiscoveryUpload preview mismatch and the "Open questions"/"Open Questions" casing are
  mechanical and could be unified now if you greenlight (I held off to avoid pre-empting the
  naming call).
- **[P2] /interviews?new=1 create-intent is dropped (lane-k domain).** /plans/page.tsx
  redirects `?new=1` → /interviews?new=1, but interviews/page.tsx takes only `params` and
  ignores the query — the canonical create route is /interviews/new (K3). So the redirect's
  carried "create" intent lands on the list, not the create screen. Recommend lane-k point
  the /plans redirect (and drop any ?new=1) at /interviews/new.
- **[FYI, not mine] ObserverView.tsx tsc error** in another lane's uncommitted WIP:
  `TS2552: Cannot find name 'TopicCoverage'` (line 149). The frontend does not fully
  typecheck right now because of it — flagging so the owning lane clears it before its
  commit / the deploy seam.

## Prompts / personas / evals
Read-only per instruction. context-collector opener carries the no-em-dash self-rule and the
beta-honesty boundaries; consent-landing context branch matches consentCopy() (guard green).
No stale reference to the old /plans structure or old welcome promises found in prompts.
