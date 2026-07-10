-- 0023_workflow_taxonomy.sql — SIMPLIFY lane C (docs/SIMPLIFY-PLAN.md §4-C, Feedback C).
-- Two nullable, additive columns so the Workflows list can group by department and show a
-- one-line "what is this" per card without opening each workflow.
--   department  — a coarse function bucket (Operations / Sales / Marketing / …). The
--                 schema-builder writes it ONLY when the evidence clearly places the
--                 workflow in one department; unclear stays NULL and renders under "All",
--                 never guessed (non-negotiable: Nexus classifies only when confident).
--   description — a short client-language summary of what the workflow does, always written
--                 at build time. NULL for pre-existing rows until the one-off backfill runs.
-- No confidence column: workflow confidence is DERIVED at read time from the existing step
-- `verified` ratio (maps through the real trust ladder), never a stored/second-guessable field.
alter table workflows add column if not exists department  text;
alter table workflows add column if not exists description text;
