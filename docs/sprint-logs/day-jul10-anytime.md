# LANE-QUALITY — ANYTIME-CONTEXT (the knowledge-engine loop)

Assignment: team-lead (after A.6 gate closed). Orders: docs/ROOM-PARITY-ANYTIME-orders.md
"FEATURE-NAME: ANYTIME-CONTEXT" + team-lead's 5-point synthesis.
Ownership (this feature): Home/snapshot components + the backend mint path + intake wiring.
HARD BOUNDARY: the room (components/interview/**) is lane-sec's ROOM-PARITY — REUSE UNTOUCHED.
InterviewClient composer ownership reverted to lane-sec (my composer commit landed+deployed).
Law: A28 per change, own revertable commits, evals ride behavior, push each.

## What already exists (ride it, don't rebuild — team-lead point 4)
- **Mint path:** `POST /api/workspaces/{id}/context-call` (workspaces.py:333) already mints a
  fresh `session_kind='context'` session on an existing workspace, resolves the CEO/founder
  entity as speaker, returns `{token, invite_path: /i/{token}}`. NO once-only gate → already
  additive. Gated on `config.beta_context_call` (403 otherwise) — same gate as the first call.
  Frontend wrapper: `start_context_call(workspace_id)` (live.ts:1079).
- **Additive compile:** compiler.py supersedes/appends across sessions via the prior-records
  UUID block — a second context call's compile folds into the SAME workspace records
  (corrections supersede, tags never upgrade). Proven July 8 (second-transcript append).
- **Storage backbone (ADD-4 parity):** the intake store_context path (plans.py:618) creates a
  `session_kind='context'` session + compiles at `max_tag='CLAIMED'` (quarantine at the data
  layer) with the honest chip "Saved to Company Context". The context CALL shares this backbone
  (session_kind context → compile → additive, CEO-attributed, quarantine).
- **Home surface:** `SnapshotView.tsx` IS Home. Header carries ExportReportButton (L155) +
  "Your next move" (L203). SnapshotView L648-652 documents a REMOVED dead "Add context (chat)"
  affordance awaiting "the real add-context action" — ANYTIME-CONTEXT is that action.

## The build (each A28-prereviewed, own commit)

### A28 pre-review — Change 1: "Add more context" button on Home/Snapshot
- Today → after: SnapshotView header has Export (quiet secondary) + the snapshot; no way to
  add more context after the first call (the real add-context action was a removed no-op) →
  after, a primary-ish "Add more context" button near Export/next-move. Click → `start_context_call`
  → `router.push(invite_path)` into the SAME room (reused untouched). Shown only when the
  workspace has a compiled snapshot AND `beta_context_call` is enabled (else the mint 403s).
- Simpler or more complex for the user? Simpler — it turns the one-shot intake into the
  knowledge engine Kaan keeps asking for; one clear invitation, reuses a room they know.
- Paths: `frontend/src/components/snapshot/SnapshotView.tsx` (+ maybe a tiny presentational
  child). Reuses `start_context_call`. No room edit.

### Change 2 (mint path): optional modality on the context-call endpoint
- Orders say "voice or text". The endpoint hardcodes modality='voice'. Add an optional
  `modality: 'voice'|'text'` (default 'voice' — byte-identical to today when omitted) so the
  button can offer text (fast add) too. Paths: `workspaces.py` context-call endpoint + live.ts
  wrapper. Own commit.

### Change 3 (evals): additive-context storage semantics (mirror ADD-4 / test_intake.py)
- Pin: an additive context call's fact → CLAIMED, CEO-attributed; an opinion about a named
  person → quarantined (never client_visible); a vague input → no durable record; a correction
  → supersedes (both survive, tags never upgrade). Mirrors test_intake.py's plan_only/store_context
  + quarantine asserts, on the additive-context path. Own commit, rides the behavior it pins.

## TEAM-LEAD RULINGS (received) + how they landed
- **D1 CLAIMED cap — APPROVED.** Mechanism (mine + one line lane-mest): migration 0028 adds
  `interview_sessions.compile_max_tag`; the mint sets it to 'CLAIMED' when a prior context call
  exists (additive), null on the first call (its CONFIRMED behavior unchanged, A24). The compiler
  already selects `s.*` and resolves `max_tag = payload.get("max_tag")` (compiler.py:195), so the
  ONLY lane-mest change is a one-line fallback `... or session["compile_max_tag"]` — covers BOTH
  completion paths (text + voice) at once. Announced to lane-mest. The ontology asymmetry (first
  CONFIRMED vs additive CLAIMED) is team-lead's Kaan+Emre review item — I did NOT touch the first call.
- **D2 confirm-what-to-store — APPROVED phased.** Shipping the call-based honesty now (CLAIMED +
  quarantine + records rendering in Company Context). v2 gate note below. Deferral is on Kaan's list.
- **D3 modality — MODIFIED: voice primary, text secondary.** Landed (Mic button + "or type it").

## v2 confirm-what-to-store gate (design note for later, per D2 — NOT built now)
A post-call REVIEW SCREEN (not an in-room gate — an in-room keep/discard would collide with R1's
respondent-facing counts-only rule, since the founder self-serve call is a respondent surface).
After an additive call compiles, show the newly-added facts as the ADD-4 "Saved to Company Context"
chips and let the CEO discard any before they're kept — reusing the intake chip component + the
supersede/soft-delete the ontology already supports. Deferred to v2; flagged to Kaan verbatim by team-lead.

## FOR-TUNC (chassis reuse)
ANYTIME-CONTEXT is almost entirely ride-don't-rebuild on vendored chassis: the additive compile rides
the queue + compile seam (Tunç's queue chassis), and the mint reuses the existing context-call session
creation. Net-new is only the entry button + a per-session compile cap. (Logged to docs/FOR-TUNC.md.)

## (superseded) decisions originally flagged
1. **CLAIMED cap.** ADD-4 (and the orders) say additive context is "attributed to the CEO as
   CLAIMED". But the FIRST context call compiles up to CONFIRMED (verified: test-mest records
   carry CONFIRMED tags). A CEO's own single account arguably should cap at CLAIMED
   (non-negotiable: one person's account never above CLAIMED). Capping the additive call at
   CLAIMED touches the COMPLETION-compile path (sessions.py/voice.py — NOT my rows) or a per-
   session max_tag flag. RECOMMEND: cap ANYTIME-CONTEXT calls at CLAIMED (matches ADD-4 + the
   non-negotiable), via a session flag read at completion — needs a one-line coordination with
   whoever owns complete(). Confirm + I'll coordinate.
2. **Confirm-what-to-store gate.** For a full CALL, there is no per-fact discard gate; the
   honesty is the existing CLAIMED/quarantine + Company-Context/snapshot rendering (same as the
   first call). A per-fact "keep/discard" gate INSIDE the room would need room changes
   (lane-sec). RECOMMEND: ship the call-based honesty (CLAIMED-tagged, quarantined, shown in
   Company Context) as the confirm-what-to-store; add a per-fact gate later only if Kaan wants
   it. Confirm.
3. **Modality default** for the button: voice (matches first call) or text (fastest quick-add)?
   RECOMMEND: offer both, default text for a quick add. Confirm.

## Audit verdicts (one line per landed commit)
- **Change 1 (Add more context button) — GREEN.** New `AddMoreContextButton.tsx` (mints an
  additive context call via the existing `start_context_call`, navigates to the reused room,
  error path surfaces + does not navigate) wired into the SnapshotView header beside Export,
  gated on `workspace.config?.beta_context_call` (matches the mint's 403 gate). Room UNTOUCHED.
  tsc clean; add-more-context.test.tsx 2/2; snapshot-intro 3/3 (no regression). Defaults to
  voice (the polished room) pending team-lead's modality decision. A28 own commit.
- **Change 2 (mint modality param) — GREEN.** `POST /context-call` gains optional
  `modality: 'voice'|'text'` (default 'voice' = byte-identical; invalid → 422); live.ts wrapper
  threads it. test_context_call.py 7/7 incl. a new additive-mint test (two clicks → two distinct
  context sessions, no once-only gate) + voice-default/text/invalid-422. A28 own commit. NOTE:
  touched the context-call endpoint in workspaces.py (the granted mint path) — announced.
- **Change 3 (CLAIMED cap, my parts) — GREEN.** migration 0028 (`compile_max_tag` column) +
  mint sets it 'CLAIMED' for additive calls / null for the first (A24) + conftest 0028 registered.
  test_context_call.py 8/8 incl. the cap test (first→null, additive→CLAIMED). ONE line remains in
  lane-mest's compiler.py:195 (`or session["compile_max_tag"]`) to make the cap end-to-end — announced
  to lane-mest with the exact diff. Mint-layer verified now; end-to-end cap lands with their one-liner.
