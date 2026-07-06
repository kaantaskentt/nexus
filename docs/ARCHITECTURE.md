# Architecture — why / what / where in 5 minutes

**Product in one line:** Nexus is a world-class interviewer and context extractor. It finds
context, not solutions. (README.md carries the full statement; docs/MERGE_PLAN.md is the
spec and wins every conflict.)

## Directory map

```
config/       brand.json — the ONLY home of the product name/sender identity (A13.2)
backend/      FastAPI + asyncpg service
  db/migrations/   numbered SQL, applied to Supabase (0001 foundation … 0005 context-chat)
  app/
    main.py        API entry — mounts routers: workspaces, claims, plans, sessions, voice, reports, chat
    worker.py      queue worker entry (python -m app.worker)
    queue.py       jobs table, SKIP LOCKED claim loop (vendored pattern, see reference/SOURCES.md)
    llm.py         every model call: agent_configs row → prompt file → agent_runs audit;
                   injects {{INDUSTRY_CALIBRATION}} + {{PRODUCT_NAME}} at load
    pipeline/      the product's verbs: compiler (Stage 4), entities, pain, handoff,
                   interview (turn engine), conflicts (perception gaps), workflow, quality
    routers/       thin HTTP; client-facing claim reads go through the
                   client_visible_claims VIEW only — never the base table
frontend/     Next.js 14 app-router UI; design tokens in src/app/globals.css (A15.1);
              components enforce trust rules (badges, paraphrase, facts-only why-lines)
prompts/      the IP: agent prompts, rubrics, lexicons, personas copy, industry examples
evals/        eval suites + harness (direct & http adapters), adjudication evidence,
              scenario generator; docs/EVALS.md is the honest coverage map
reference/    read-only: Tunç's repos, stage docs, UI mockups (A15 ground truth)
docs/         MERGE_PLAN (spec), ENVIRONMENT, FOR-TUNC (deviation log), EVALS,
              voice-config, this file
```

## Data flow (happy path)

1. **Recon (Stage 1):** Firecrawl/Apify → `scrape_sources` → SCRAPED claim records
   (≈20% reference weight; never verified).
2. **Heuristics (Stage 2):** falsifiable priors, auto-scored later at compile (F12/F13).
3. **CEO call → compile (Stage 4):** verbatim `utterances` → `pipeline/compiler.py` →
   trust-tagged `claim_records` (kind/topic/tag; corrections supersede — records are
   immutable by DB trigger; sentiment quarantined at insert by DB trigger).
   Post-compile fan-out (async): pain rater, conflict/perception-gap linker,
   workflow schema builder, interview-quality score.
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

## Design notes / known v1 shapes

- `resumable_state` on sessions holds runtime state AND the post-compile quality score;
  coverage tracking is model-side (re-derived from replayed transcript) — the
  `objectives` field is a static echo, marked as placeholder for future computed coverage.
- Model tiering lives in `agent_configs` (strong model in every demanding seat — EK #1).
- F21 conflict precedence is provisional in `precedence_lean()` pending Emre's policy.
