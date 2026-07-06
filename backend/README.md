# backend/

FastAPI + asyncpg service: the claim-record ontology, job queue, agent runner, interview turn engine, and voice sidecar. Schema lives in `db/migrations/` (applied to Supabase); pipeline logic in `app/pipeline/`; tests run against a local pgvector container, never a live tenant.

## Running the stack — TWO processes, both required

```
uvicorn app.main:app          # the API
python -m app.worker          # the queue worker — REQUIRED
```

The API only *enqueues* jobs; the worker drains them. Everything downstream of an
enqueue runs on the worker: plan APPROVED → handoff build, interview complete →
compile → the whole Phase-6 fan-out (pain, conflicts, workflow, quality, heuristics)
→ snapshot render. **Run the API without a worker and the failure is silent and at the
product's payoff moment** — a plan approves but no handoff appears; a respondent finishes
their interview and no report is ever produced. If a compiled artifact never shows up,
check that the worker is running first.

## Admin flow (A17) + fail-loud

- The API gains no auth of its own; admin auth is a frontend concern (Supabase middleware).
  What lives here: the multi-company endpoints on the workspaces router — `POST /api/workspaces`
  (mint a real `is_demo=false` tenant), `POST /api/workspaces/{id}/discovery` (store a CEO
  transcript verbatim, enqueue the standard `compile_session`), the paired
  `.../discovery/{session_id}/status` poll, and `.../recon` + `.../recon/status` for the
  optional website scan. Admin logins are provisioned with `python -m scripts.create_admin`.
- **Fail loud (#22):** an agent that returns unparseable JSON makes `run_agent_json` raise
  `AgentParseError`, so the job fails and retries instead of silently finishing with nothing
  written. The raw output is on the `agent_runs` audit row (`output_ref.text`).

## Environment conventions (read before touching a DB)

- **`.env` `DATABASE_URL` is the LIVE Supabase pooler** (A12 footgun). Local dev and
  tests must pin the container DSN explicitly (`postgresql://postgres:nexus@localhost:55432/nexus_eval`
  for dev, `nexus_test` for the suite via `conftest`). Never let a local worker or test
  run against `.env` — that would compile fixtures into the live tenant.
- **`EVAL_MODE` stays OFF (unset/false) in every deployed env.** It double-gates the
  eval-bootstrap route with `is_demo`; on in production would let synthetic sessions in.
- **Deploy is two Railway services off one image**, branched by `NEXUS_PROC` in `start.sh`
  (`api` binds `$PORT`; `worker` drains the queue). Redeploy: `railway up -s <svc> --ci`
  from repo root. `CORS_ORIGINS`, `VOICE_SHARED_SECRET`, `APP_BASE_URL` are set per service.
- **Migrations are applied by hand** to each Supabase DB (no auto-migrate on boot); apply
  a new `NNNN_*.sql` to the container AND live, and add it to `conftest.MIGRATIONS`.
- **Brand is config (A13.2):** the backend reads `config/brand.json` at runtime; the
  frontend uses a committed synced copy (`frontend/src/lib/brand.data.json`) so Vercel's
  frontend-root build can resolve it. Rename the product in one file.

