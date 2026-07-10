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
