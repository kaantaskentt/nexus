-- 0015_voice_test.sql — "Hear it live" voice test sessions (premium audit P1-3, July 7).
-- Kaan's probe "quickly test a voice" dead-ended: no preview clips (stock ones banned,
-- no TTS keys) and no way to hear the assistant short of sending a real interview.
-- A voice_test session is the admin's own throwaway call: real assistant, real opener,
-- real voice — but it NEVER compiles into the record store, never runs the disclosure
-- screen, and never appears in the Interviews list (kind-filtered queries).

alter table interview_sessions drop constraint if exists interview_sessions_session_kind_check;
alter table interview_sessions add constraint interview_sessions_session_kind_check
  check (session_kind in ('interview', 'context', 'eval', 'people_map', 'demo', 'voice_test'));
