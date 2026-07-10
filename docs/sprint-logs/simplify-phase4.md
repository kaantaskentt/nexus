# SIMPLIFY Phase 4 — anti-over-engineering + verification (task #12, audit-walk)

Two parts: (A) a STATIC anti-over-engineering pass, doable now; (B) prod re-walk of every
changed surface + full suites + delta review, GATED on seam-2 deploy. This log holds A now;
B fills in after seam-2.

## A · Static anti-over-engineering pass (done)

Scope: 72 files, +5783/-959 since pre-sprint (a8a9a98).

**No structural bloat flags:**
- **No new dependencies.** frontend/package.json unchanged — nothing pulled in; new UI
  reuses existing framer-motion/lucide/tailwind tokens.
- **New files are proportionate**, each maps 1:1 to a lane feature: live_capture.py (E),
  interviews/new + AssignInterviewFlow + StageRail (K), WorkspaceDeleteDialog/ReorderList +
  deletion.py (A), SnapshotIntro (B), WorkflowConfidenceChip/WorkflowsList (C), roleplayBrief
  (J), plus one test file each. No speculative abstraction layer, no parallel framework.
- **Largest changes are the genuinely-complex screens**, not gratuitous: PlanView 993
  (K1 relayout of the page Kaan called "messy"), AssignInterviewFlow 681 (K3 — one screen
  replacing a 3-hop create flow, a net simplification for the user even though the component
  is large), WorkflowEditor +335 (C detail rebuild), AppShell +266 (responsive foundation),
  live_capture 180, deletion 158. All map to real, requested scope.

**Watch items for the seam-2 read (not yet flags, just "look closer"):**
- PlanView.tsx at 993 lines is the single biggest surface — worth one focused read at
  seam-2 to confirm the topic-grouping + refine-chat + gate-footer didn't accrete duplicate
  state. (Lane-k active; premature to deep-read in-flight.)
- WorkflowEditor (my lane C): the step cards and the details panel both render
  Tool/Input/Output (card = summary, panel = full detail). Mild duplication, matches the
  image13 spec; noting for the "is this necessary" check — my call is keep (the panel adds
  Trigger/Notes/step-confidence the cards omit).
- Carried from Phase 3: done-page "first version" drift (P1, lane-e file) and the
  next-round-question naming spread (P2) — see simplify-phase3.md.

## B · Verification (GATED on seam-2 — TODO)
- [ ] Full backend suite (at the seam, not during active lanes — shared test-DB rule).
- [ ] Full frontend suite (blocked now: ObserverView.tsx has a live tsc error in an
      uncommitted lane WIP — see phase3 log item 4; must clear before a clean full run).
- [ ] Prod browser re-walk of EVERY changed surface, desktop 1440 + mobile 390, using the
      Phase-0 method (resize-to-half for the profile-zoom bug). Priority surfaces: picker
      reorder/delete (A), snapshot intro + done page (B/G), Workflows list+detail (C),
      context-call welcome (D), interview hub + plan page (K), live room (E/F), play-
      character (J). Confirm the P0 mobile fix (AppShell drawer) holds on each.
- [ ] Delta review vs pre-sprint behavior: no tested capability regressed.
