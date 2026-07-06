-- 0005_chat_context.sql — the V2 context-chat agent (V2-PLAN #20 / decision #2).
-- Sources: docs/V2-PLAN.md decision #2 · prompts/agents/chat-context.md.

-- The context-chat agent answers admin questions grounded in client_visible_claims,
-- citing record ids. Strong seat (grounded reasoning over the record store); same
-- audit trail as every other agent via run_agent.
insert into agent_configs (agent_name, model, prompt_path) values
  ('chat_context', 'claude-sonnet-4-6', 'prompts/agents/chat-context.md')
  on conflict (agent_name) do nothing;
