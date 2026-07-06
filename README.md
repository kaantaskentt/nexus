# Nexus

**Nexus is a world-class interviewer and context extractor. It finds context, not solutions.**

It learns how a company actually works — through recon, one human-led CEO call, and AI-conducted employee interviews — and compiles every conversation into trust-tagged claim records. Those records render a living Company Snapshot: what we learned, where the pain is, who to talk to next, what's disputed, and where the CEO's beliefs diverge from the floor's reality.

## What Nexus outputs (v1)

1. The trust-tagged **record store** (every claim traceable to a verbatim quote)
2. The living **Company Snapshot** dashboard
3. **Conflict + perception-gap findings** (the golden data)
4. Verified **workflow maps** (spine-slot complete)
5. **SOP documents**

Executable skill generation is deliberately deferred; the schema preserves spine-slot metadata so a skill compiler can consume the record store later without redesign.

## Repo layout

- `docs/` — MERGE_PLAN.md (the build plan + all July 5 decisions) · ENVIRONMENT.md (credentials checklist)
- `prompts/` — the IP: agent system prompts, interviewer personas, rubrics, hedge lexicons
- `evals/` — golden transcripts + expected-record fixtures + failure-mode tests
- `backend/` — FastAPI · Postgres (Supabase) · pgvector · in-DB job queue
- `frontend/` — Next.js, built to the Stage 5/6/8 mockups
- `reference/` — pointers to Tunç's original repos (vendoring source, never edited here)

## Ground rules (from the spec)

- Tags never upgrade; truth emerges from comparison between records, not editing them.
- Objectives shape questions, never statements. Nothing the CEO said reaches an interviewee.
- Nothing talks to employees without explicit human approval.
- Scraped ≈ 20% reference weight; the transcript is the product.
- Every generated artifact traces to named source docs — no free-styling.
