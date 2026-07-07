-- 0013_people_map.sql — people-map branch session kind (stage-3 v04, merged A24).
-- Sources: docs/emre-inbox/stage-3-ceo-call-v04.md (people-map branch: an intermediate
-- 10-15 min interview with a named person when the exec cannot name who does the work;
-- scope strictly the people map; records CLAIMED, reads quarantined; branch closes when
-- each target process has a named primary interviewee with a read; scheduled before any
-- interview plan generates) · MERGE_PLAN A24.
--
-- Human-led during the services phase (uploaded like a discovery transcript), agent-led
-- later behind the same Stage-6 gate as any interview. The kind travels so plan
-- generation and the Interviews list can tell a people-map intake from a real employee
-- interview; the compile path is the standard one (quarantine still binds at the data
-- layer — the exec's and the manager's reads are sentiment-flagged like anyone's).

alter table interview_sessions drop constraint if exists interview_sessions_session_kind_check;
alter table interview_sessions add constraint interview_sessions_session_kind_check
  check (session_kind in ('interview', 'context', 'eval', 'people_map'));
