-- 0008_coverage_tracker.sql — the computed-coverage classifier seat (V3 coverage-routing).
-- Sources: evals/adjudication/morning-review-packet.md §5 (TOP V3 engineering proposal) ·
-- backend/app/pipeline/coverage.py · prompts/agents/coverage-tracker.md.
--
-- The turn engine computes objective coverage server-side each turn (satisfied/partial/
-- untouched) instead of leaving it re-derived in the interviewer's head, and hard-gates the
-- close on any untouched must-hit. That classification runs through the standard agent_config
-- + agent_runs audit trail like every other model call. STRONG seat (it steers whether a
-- must-hit gets probed before an interview ends — never a mini model here, EK #1 / #7).

insert into agent_configs (agent_name, model, prompt_path) values
  ('coverage_tracker', 'claude-sonnet-4-6', 'prompts/agents/coverage-tracker.md')
  on conflict (agent_name) do nothing;
