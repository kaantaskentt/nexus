# Nexus

**Nexus is a world-class interviewer and context extractor. It finds context, not solutions.**

Nexus learns how a company actually works — through light web recon, one human-led CEO call, and AI-conducted employee interviews — and compiles every conversation into **trust-tagged claim records**, each traceable to a verbatim quote. Those records render a living **Company Snapshot**: what we've learned, where the pain is (as coarse bands, never scores), who to talk to next, what's disputed, and where leadership's beliefs diverge from the floor's reality. The interview is the product; finding the real, on-the-ground version of the work is the whole game.

Its discipline is what makes the output trustworthy. Every claim sits on one **trust ladder** — scraped < guess < claimed < confirmed < verified — and **tags never upgrade**: truth emerges from *comparing* records, never from editing them, so a contradiction between the CEO and an operator is preserved as golden data rather than smoothed away. Sentiment about named people is **quarantined at the data layer** (not a per-screen filter), an interviewer's objectives shape its questions but nothing anyone else said ever reaches a respondent, scraped web data is worth only ~20% reference weight, and nothing is sent to an employee without explicit human approval. *("Nexus" is a working name — brand lives in one config file, `config/brand.json`; a rename is a one-line change, not a refactor.)*

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
