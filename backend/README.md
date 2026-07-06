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

