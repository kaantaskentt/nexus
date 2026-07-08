-- 0014_demo_synthetic.sql — demo transcript generator (Kaan verdict 8, July 7; A26 batch).
-- A 'demo' session kind marks a SYNTHETIC generated CEO-call compiled for live demos on
-- any workspace. The A12 firewall principle extends to record level: every record such a
-- session compiles carries provenance.synthetic=true (set structurally in compile_session
-- from the session kind, never by caller discipline), and client surfaces label it.
-- Synthetic data never blends into real records without the label.

alter table interview_sessions drop constraint if exists interview_sessions_session_kind_check;
alter table interview_sessions add constraint interview_sessions_session_kind_check
  check (session_kind in ('interview', 'context', 'eval', 'people_map', 'demo'));

-- The generator seat: one fictional, clearly-synthetic CEO-call transcript per request.
insert into agent_configs (agent_name, model, prompt_path) values
  ('demo_transcript', 'claude-sonnet-4-6', 'prompts/agents/demo-transcript.md')
on conflict (agent_name) do nothing;
