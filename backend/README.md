# backend/

FastAPI + asyncpg service: the claim-record ontology, job queue, agent runner, interview turn engine, and voice sidecar. Entry points: `uvicorn app.main:app` (API) and `python -m app.worker` (queue worker). Schema lives in `db/migrations/` (applied to Supabase); pipeline logic in `app/pipeline/`; tests run against a local pgvector container, never a live tenant.
