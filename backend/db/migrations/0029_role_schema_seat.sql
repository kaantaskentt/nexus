-- WS-1b (Emre: "schema, not hypothesis" — July 10 night orders): the pre-call industry
-- prime seat. At handoff build it turns {role, industry} into a compact map of the
-- profession's territory (process areas, tools, table-stakes practices) so the
-- interviewer walks in BCG-fluent instead of asking a data scientist what data cleaning
-- is. It receives ONLY the role and industry — never records, never mission text — so
-- nothing anyone said can reach the interviewer through it (non-negotiable #2).
--
-- Right-sized seat: this is a bounded knowledge-dump of GENERIC domain knowledge with no
-- safety judgment in it, capped small; Sonnet holds it for launch (boring over clever the
-- night before go-live), with a Haiku downshift listed as a P1 proposal.
insert into agent_configs (agent_name, model, prompt_path) values
  ('role_schema', 'claude-sonnet-4-6', 'prompts/agents/role-schema.md')
  on conflict (agent_name) do nothing;
