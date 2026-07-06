-- 0004_phase6.sql — perception-gap / conflict engine + report scoring support.
-- Sources: MERGE_PLAN Phase 6 · collision-detector prompt (kinds) · interview-quality rubric.

-- The collision detector emits kinds beyond the three perception/floor buckets
-- (now-vs-prior, call-vs-scrape). Broaden the check so every linked contradiction
-- can be stored; both records always survive (non-negotiable #1).
alter table claim_conflicts drop constraint claim_conflicts_kind_check;
alter table claim_conflicts add constraint claim_conflicts_kind_check
  check (kind in ('perception_gap', 'worker_vs_worker', 'ceo_vs_floor',
                  'now_vs_prior', 'call_vs_scrape'));

-- The interview-quality rubric exists (prompts/rubrics/interview-quality.md) but had
-- no agent_config pointing at it. Seed it so the quality scorer can run on the strong
-- model with the standard audit trail.
insert into agent_configs (agent_name, model, prompt_path) values
  ('interview_quality', 'claude-sonnet-4-6', 'prompts/rubrics/interview-quality.md')
  on conflict (agent_name) do nothing;
