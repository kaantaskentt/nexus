# SIMPLIFY mini-seam-4 — Vercel-only sim-marker persistence fix

Deployed commit: **b718074** (origin/main at pin). Frontend fix **6199a06** ("make the SIMULATION
marker persistent on every screen" — InterviewClient.tsx + LiveRoom.tsx + VoiceCall.tsx). Vercel-only.

## Pre-flight
- Push-check: origin/main (b718074) CARRIES 6199a06 (ancestor) — no unpushed trap.
- Frontend-only confirmed: delta c92ba85..b718074 touches only frontend/ + docs/ (grep for
  backend/ + migrations/002 = empty). No Railway deploy, no migrations.
- API health green (/health/deep 0/0/0).

## Deploy
- Vercel production deploy from clean worktree @ b718074: READY (nexus-v2-6jf1c27xd). /login 200.

## Verify (3 checks)
1. **Scenario-run consent page — persistent marker: PASS.** Clicked Run simulation on bee-goddess
   (did NOT start the call). Consent page now shows the marker at the top: "Simulation · Daily
   Repricing and Online Order Fulfilment — practice run. Nothing here reaches your company
   records." + "← Exit simulation" chrome. (Pre-fix this only appeared inside the room.)
2. **Employee invite consent — byte-unchanged: PASS.** /i/<pending bee employee token>: full
   Emre-primary promise intact ("A quick, honest conversation about your work"; "shared by role,
   like 'someone in operations,' not by your name"; "Nothing is quoted with your name on it";
   "You won't be asked to rate anyone"; "not a performance review"; CTA "I'm ready, start the
   conversation"). ZERO sim-marker leak (no "simulation" / "practice run" / "exit simulation").
3. **Sim room controls + marker on-screen: PASS.** Entered the sim room (one text turn, no voice).
   At 1440×900 the marker is in-view and all controls (Switch to voice, Pause, Finish) + text
   input are in-view; no horizontal overflow.

## Data hygiene
- The disposable sim session I minted for check 1/3 (259e5f4e, roleplay) was TORN DOWN
  (utterances/agent_runs/live_captures/session deleted; 0 rows remain).
- NOTE: one orphan pending roleplay session (78d704f4, created 05:17Z, 0 turns) exists on
  bee-goddess from ANOTHER agent's walk (predates my mini-seam-4 work). NOT mine — left as-is;
  flagged for the lead if cleanup is wanted.

## Result
Mini-seam-4 ROUND 1 GREEN — sim marker now persistent on consent + room, employee consent unregressed.
Prod = b718074 (6199a06 live).

## MIGRATION STATUS (do not re-apply)
Migrations **0023_workflow_taxonomy** and **0024_live_captures** are ALREADY APPLIED + VERIFIED to
live Supabase — done by hand in SEAM-2 (pooler, statement_cache_size=0; columns/table/agent_config
confirmed). The 20:35 watchtower "migrations committed but not on live" flag in SIMPLIFY-ORDERS.md
is **STALE** — do NOT re-apply. No migrations are pending.

## ROUND 2 (pending — cargo grew, HOLD)
Per lead (ADDENDUM 3, binding): a P1 voice-transcript freeze in the LiveRoom was found in Kaan's
live testing; lane-e is fixing. Mini-seam-4 will RE-DEPLOY bundling THREE frontend fixes: 6199a06
(marker, already live), bea9fac (sim consent copy), + the transcript-freeze fix (hash TBD from lane-e).
Verify = the same 3 checks PLUS driving LIVE VOICE turns in the room to confirm the transcript renders
(coordinate with lane-e on the safest repro/voice_test path). Holding for lane-e's fix hash.

## ROUND 2 — executed (P1 owned end-to-end by seam-1)
Deployed commit: **c203bc5** (Railway api+worker SUCCESS + Vercel READY nexus-v2-lywek4hzb).
Scope = config P1 fix (c203bc5) + bea9fac (sim consent copy) + 6199a06 (marker, already live).
No migrations applied (0025_intake_agent.sql is inert; not applied — belongs to the intake seam).

### P1 (ADD-3.1) — FIXED + VERIFIED END-TO-END
- Root cause (GET-verified live): both shared VAPI assistants had serverMessages but NO
  clientMessages, so the browser SDK received zero transcript events and the LiveRoom froze on
  the opener while the DB filled. Broke at the July-9 re-provision (16a2614).
- FIX: added clientMessages ["transcript","status-update","speech-update"] to vapi_assistant.py
  + provision_vapi.py (c203bc5). Re-provisioned BOTH shared assistants (Nexus Interviewer M
  0853702b / F 44d14d38) via railway-run; GET-verify: clientMessages present, auth intact,
  silence=60, ryan/sarah + stopSpeaking 2/0.4 untouched. 0 per-workspace assistants = total coverage.
- VERIFIED BY A REAL DRIVEN HEADLESS CALL: minted disposable voice session on hidden Atlas, the
  MCP Chrome had a live mic + granted permission, started a real VAPI call — the assistant's opener
  rendered LIVE on-screen token-by-token ("Hi. I'm Nexus. Thanks so much for making the time…").
  Double-confirmed: webhook also stored the opener server-side (21 agent utterances). Call ended,
  session torn down (0 rows remain). Emre unblocked for voice testing; Kaan's mic call = feel check.

### Round-2 checks (against c203bc5)
- bea9fac sim consent copy PASS: "Practice run · … a simulation, not a real interview … Nothing said
  here reaches your company records" — no real-person promise leak.
- SIMULATION marker persistent PASS (consent + room).
- Employee invite consent BYTE-UNCHANGED PASS (no sim leak).
- Transient health note: 2 failed jobs (compute_yield/screen_disclosures) from the voice-test's
  post-call jobs failing after session teardown; preceded the deploy, self-cleared (0 failed now).

### Data hygiene
- All disposable sessions I minted (voice 8f434b5e, sim 42e0ff89) torn down. Orphan roleplay
  78d704f4 torn down (lead-authorized). 2 other bee-goddess roleplays remain — other lanes' active
  sims, left as-is.

### OPEN — pin decision surfaced to lead
- ce5ec3f (frontend server-transcript backstop, defense-in-depth) landed after the c203bc5 pin and
  is stacked on top of Snapshot v2 (0d4b52b) — cannot ship the backstop without Snapshot v2. P1 is
  already fixed+live+verified WITHOUT the backstop. Awaiting lead's call: (A) re-pin 402327a +
  re-deploy Vercel (ships backstop + Snapshot v2), or (B) defer both to the seam that intentionally
  ships Snapshot v2. Recommended (B).
