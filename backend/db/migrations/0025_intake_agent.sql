-- New-interview intake agent (SIMPLIFY ADDENDUM 4). Runs the short intake conversation on
-- the assign flow: 2-3 sharp follow-ups, records/plan/coverage aware, converting answers
-- into bounded plan edits + an explicit plan-only-vs-store-as-context decision.
--
-- Strong model in a demanding seat (non-negotiable #7): the intake agent holds the same
-- safety spine as the plan refine chat and generator (no claim text into questions,
-- reformulate leading, quarantine structural) and makes the sensitive storage call, so it
-- is never a mini model. Same tier as the interviewer / compiler / refine seat.
insert into agent_configs (agent_name, model, prompt_path) values
  ('intake_interviewer', 'claude-sonnet-4-6', 'prompts/agents/intake-interviewer.md')
  on conflict (agent_name) do nothing;
