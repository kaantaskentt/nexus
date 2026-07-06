# Architecture — why / what / where in 5 minutes

**Product in one line:** Nexus is a world-class interviewer and context extractor. It finds
context, not solutions. (README.md carries the full statement; docs/MERGE_PLAN.md is the
spec and wins every conflict.)

## Directory map

```
config/       brand.json — the ONLY home of the product name/sender identity (A13.2)
backend/      FastAPI + asyncpg service
  db/migrations/   numbered SQL, applied by hand (0001 foundation … 0008 coverage-tracker)
  scripts/         seed_demo.py (is_demo fixtures) · create_admin.py (A17 admin logins)
  app/
    main.py        API entry — mounts routers: workspaces, claims, plans, sessions, voice, reports, chat, workflows
    worker.py      queue worker entry (python -m app.worker)
    queue.py       jobs table, SKIP LOCKED claim loop (vendored pattern, see reference/SOURCES.md)
    llm.py         every model call: agent_configs row → prompt file → agent_runs audit;
                   injects {{INDUSTRY_CALIBRATION}} + {{PRODUCT_NAME}} at load;
                   run_agent_json raises AgentParseError on bad JSON (fail/retry, never a silent drop)
    pipeline/      the product's verbs: compiler (Stage 4), entities, pain, handoff,
                   interview (turn engine), conflicts (perception gaps), workflow, quality
    routers/       thin HTTP; client-facing claim reads go through the
                   client_visible_claims VIEW only — never the base table
frontend/     Next.js 14 app-router UI; design tokens in src/app/globals.css (A15.1);
              components enforce trust rules (badges, paraphrase, facts-only why-lines);
              src/middleware.ts is the A17 auth gate (Supabase session; /w/* + / gated, /i/* public)
prompts/      the IP: agent prompts, rubrics, lexicons, personas copy, industry examples
evals/        eval suites + harness (direct & http adapters), adjudication evidence,
              scenario generator; docs/EVALS.md is the honest coverage map
reference/    read-only: Tunç's repos, stage docs, UI mockups (A15 ground truth)
docs/         MERGE_PLAN (spec), ENVIRONMENT, FOR-TUNC (deviation log), EVALS,
              voice-config, this file
```

## Data flow (happy path)

0. **New company (Stage 0, A17):** admin signs in, `POST /api/workspaces` mints a REAL
   tenant (`is_demo=false`, zero records — A12), lands on a guided empty state. Optional
   `POST /api/workspaces/{id}/recon` runs the Stage-1 scan; `.../discovery` uploads the
   CEO transcript (stored verbatim) and enqueues the standard compile.
1. **Recon (Stage 1):** Firecrawl/Apify → `scrape_sources` → SCRAPED claim records
   (≈20% reference weight; never verified).
2. **Heuristics (Stage 2):** falsifiable priors, auto-scored later at compile (F12/F13).
3. **CEO call → compile (Stage 4):** verbatim `utterances` → `pipeline/compiler.py` →
   trust-tagged `claim_records` (kind/topic/tag; corrections supersede — records are
   immutable by DB trigger; sentiment quarantined at insert by DB trigger).
   Post-compile fan-out (async): pain rater, conflict/perception-gap linker,
   workflow schema builder, interview-quality score. The discovery upload flags the
   compile to auto-complete the founder round and render the snapshot — a structural gate
   (`_should_render_snapshot`: plan-less session only) keeps that off employee interviews,
   which never re-render mid-round (A3). Progress is polled via
   `GET .../discovery/{session_id}/status` (honest per-stage state, real record/card counts).
4. **Snapshot (Stage 5):** `snapshot_cards` re-rendered append-only per completed
   interview round (A3) — never mid-interview.
5. **Plan + gate (Stage 6):** `interview_plans` walk a 12-state machine (server-validated);
   on APPROVED a `handoff_packages` row is built — objectives/questions/NEVER-list only,
   structurally no claim text, no quarantined content.
6. **Interview (Stage 7):** `pipeline/interview.py` turn engine, transport-agnostic.
   Text chat posts to `/api/sessions/by-token/{token}/turn`; voice arrives via VAPI
   custom-LLM at `/api/voice/chat/completions` (same brain, streamed SSE).
   Verbatim transcripts with word timestamps are the compiler's raw material.
7. **Report (Stage 8):** `GET /api/reports/{session_id}` — workflow canvas, perception
   gaps (F27: revealed only here), conflict points, quality score.

## Trust architecture (the part that must never regress)

- Trust ladder: SCRAPED < GUESS < CLAIMED < CONFIRMED < VERIFIED. Tags never upgrade;
  truth emerges from comparing records (supersede links), never editing them.
- Quarantine is a data-layer property: DB trigger forces `sentiment_flag → quarantined`;
  the `client_visible_claims` view omits quarantined rows AND the sensitive columns.
- The interviewer's whole world is the handoff package. Nothing anyone said reaches a
  respondent; enforcement is at package construction.
- `is_demo` firewall (A12): fixtures live only in demo tenants; the eval-bootstrap route
  is double-gated (EVAL_MODE env + is_demo only).

## Auth boundary (A17)

- Auth gates the **admin UI**, not the API. `frontend/src/middleware.ts` (Supabase session
  via `@supabase/ssr`) redirects anyone without a session off `/` and `/w/*` to `/login`.
  Interview links `/i/[token]` stay token-based and unauthenticated BY DESIGN.
- **No signup.** Admins are created by hand with `backend/scripts/create_admin.py`
  (writes `auth.users` + `auth.identities` directly; normalizes GoTrue token columns).
- The FastAPI API itself still **trusts the network** (no JWT verification) — the browser
  only reaches it through authed admin pages, and the interview/eval paths must stay open.
  This is the pre-A17 posture, named honestly (FOR-TUNC #16), not a regression. When the
  API needs tenant isolation, verify the Supabase JWT in a FastAPI dependency.

## Deploy

- **Frontend → Vercel** (project `nexus-v2`). Root-dir is `frontend`, but the build runs
  from the repo root so `frontend/src/lib/brand.data.json` (the synced brand copy) resolves.
  Vercel ships the **worktree as-is** — deploy only from a clean tree, or uncommitted work
  goes to prod. `NEXT_PUBLIC_*` env vars (API URL, VAPI, Supabase URL + anon key) live in
  the Vercel project; the Supabase keys are public and stored `plain`, not `sensitive`
  (sensitive is write-only and unverifiable). Confirm `.vercel` points at `nexus-v2`.
- **Backend → Railway**, two services (`api` + `worker`) off ONE image and `start.sh`,
  branched by `NEXUS_PROC` (api binds `$PORT`; worker drains the queue). Build context is
  the repo root so `config/` + `prompts/` resolve. `railway link` the right project/service
  BEFORE `railway up -s <svc> --ci`. Migrations are applied by hand to each Supabase DB.

## Design notes / known v1 shapes

- **Fail loud, never silent (#22):** `run_agent_json` raises `AgentParseError` when an agent
  returns unparseable JSON — the owning job fails and retries instead of finishing `done`
  with nothing written. The raw model output is persisted on the `agent_runs` audit row
  (`output_ref.text`) so the failure is debuggable, not lost.

- `resumable_state` on sessions holds runtime state AND the post-compile quality score;
  coverage tracking is model-side (re-derived from replayed transcript) by default. A
  computed server-side coverage map (`pipeline/coverage.py`, `coverage_tracker` seat) is
  built and unit-tested but ships dormant behind `config.coverage_routing` — the A/B found
  the persona already covers explicit must-hit objectives, so it earns no per-turn model
  call yet (evals/e2e/proof-matrix.md). `resumable_state.coverage` holds the map when on.
- Model tiering lives in `agent_configs` (strong model in every demanding seat — EK #1).
- F21 conflict precedence is provisional in `precedence_lean()` pending Emre's policy.
