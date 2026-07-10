# SIMPLIFY round-3 (seam-4 round-3) — deploy + prod verify

Deployed commit: **0fd1f3d** (Railway api+worker + Vercel). Cargo: Snapshot v2 (0d4b52b),
Insights fold + nav retire + Report rename (2fd4881/3b7be95/b89114b), P1 backstop ce5ec3f +
masking-guard 8c74190, ADD-4 intake agent complete (1b0d3c8/cb0c8de/38f8504/624600f) + guard
a3f6caf, lane-a robustness (72b3cef delete-cascade, 71181bb yield/disclosure session-gone).

## Pin / deploy
- Same unpushed-payload + intake-entanglement traps caught pre-deploy; lead pushed (pin 5def14a
  → final 0fd1f3d) and made the intake decision. Confirmed IN CODE (lead's request): intake
  auto-advances after draft and 500s visibly without 0025 — NOT a silent no-op. Lead's fix:
  a3f6caf gates intake behind NEXT_PUBLIC_INTAKE_ENABLED (default OFF), and we ship it ON.
- **Migration 0025 APPLIED** (agent_configs seed for 'intake_interviewer'; verified present).
- **NEXT_PUBLIC_INTAKE_ENABLED=1** set in Vercel production env BEFORE the build (inlined). Flag =
  instant rollback.
- Railway api SUCCESS (03d03c27) + worker SUCCESS (5f1751ac), Vercel READY (nexus-v2-8rdr28sa7).
  Post-deploy /health ok, /health/deep ok, /login 200.

## Verify
### Snapshot v2 (0d4b52b) — reader-first
- Desktop 1440: PASS. Hierarchy = Company Snapshot → The story so far (stat row) → Your next move
  → Needs your attention (pain cards, severity badges) → Key findings (6 ranked pain-point
  articles, dept tags) → People to interview (deep-link to plans) → What Nexus learned → Sources.
  No clobber/duplication, no overflow. Finding card → right-side INLINE-EVIDENCE panel (pain level,
  frequency, trust ladder) — the documented "deep-links with inline-evidence fallback".
- Mobile 390 (true, zoom-compensated): PASS — scrollWidth 390, sidebar hidden, hamburger, no overflow.
- Note: bee-goddess has no automation-opportunity section (data-empty) and its findings render the
  inline-evidence fallback rather than an opportunity→workflow deep-link, so the "ROI-as-estimate
  styling + opportunity→workflow deep-link" specifically was NOT exercisable on this tenant.

### Insights fold (ADD-3.3)
- Insights GONE from nav (Home/Interviews/Workflows/Company Context/Simulations/Settings). PASS.
- /w/bee-goddess-demo/insights → redirects to /home (no 404/500). PASS.
- Key findings + pains hosted on Home. PASS.

### P1 backstop (ce5ec3f + masking-guard 8c74190) — driven
- Minted disposable atlas voice session, started a real VAPI call → the 2.5s server-transcript
  POLL fires (recurring GET /api/sessions/by-token/... in network tab). PASS.
- Webhook-replay: POSTed 2 VAPI-shaped transcript events (server-only, not client events) → both
  rendered on-screen within ~4s WITH NO RELOAD (poll adopted them). PASS.
- Masking-guard warn fired ONCE (expected pass signal, per lane-e): "voice transcript recovered
  from the server; the VAPI client event stream may be degraded (check assistant clientMessages)".
- Session torn down (21 utterances/2 agent_runs/session deleted; atlas clean).

### INTAKE agent LIVE (ADD-4, 0025 + flag) — driven on aurora-atelier (no hidden tenant is
  admin-accessible; used a non-demo placeholder + full teardown)
- /interviews/new (Name+Role+Focus) → Draft → intake phase auto-opens, agent asks a sharp first
  question, safety promise present ("nothing you say here is ever spoken to Elif as a statement").
- Answered with a company FACT → (a) bounded plan edits landed (Add · Handling Notes + a Question),
  (b) storage chip "Saved to Company Context" with honest rationale, (c) "Skip these" present.
- DB spot-check: the fact compiled into 2 CLAIMED process_step records (correct tag), provenance
  seeding interview objectives (speaker labelled generic "respondent" = the intake answerer).
- HARD verify (create flow completes end-to-end): PASS — draft → intake → Continue to setup path.
- TEARDOWN: deleted the plan, 2 CLAIMED records, plan_state_transitions, 10 agent_runs, and the
  fresh Elif entity. aurora restored clean (0 left).

### Health / jobs
- Post-verify /health/deep ok, failed_jobs 0. The voice call's post-call jobs queued (~9) and
  drained to ~1 with ZERO failures — the lane-a robustness (71181bb session-gone handling) works
  (contrast the round-2 transient failures before it landed).

## Result
Round-3 GREEN. P1 backstop proven headlessly, intake agent live + honest storage + CLAIMED
compile, Insights folded, Snapshot v2 reader-first both widths. Closes #16/#17. Intake flag =
instant rollback if Kaan's use surfaces anything. Prod = 0fd1f3d.
