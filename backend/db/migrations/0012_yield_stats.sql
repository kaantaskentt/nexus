-- 0012_yield_stats.sql — per-question yield + final coverage on the session (Emre stage-7
-- §10, merged A24). Sources: docs/emre-inbox/stage-7-interview-agent-draft1.md §10 ("per-
-- question yield stats ... the Question Yield Score is where the extraction methodology
-- starts measuring itself") · MERGE_PLAN A24.
--
-- yield_stats is a post-compile computed artifact, written by the compute_yield job:
--   { "questions": [{"turn_index", "question", "records", "mentions"}...],
--     "unattributed_records": n, "total_records": n, "zero_yield_questions": n,
--     "coverage": [...final coverage audit or null...], "computed_at": iso }
-- Deterministic core (verbatim evidence_quote -> respondent turn -> preceding agent
-- question); the coverage audit rides fail-open. Internal/analytics surface — feeds the
-- plan's objective statuses and future question-bank tuning, never a client promise.

alter table interview_sessions add column if not exists yield_stats jsonb;
