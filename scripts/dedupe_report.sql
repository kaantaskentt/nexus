-- WS-6 dedupe report (READ-ONLY — GATE-1: no deletion runs from this file).
-- Cross-session exact-text duplicates for one workspace: the July 10 exhaustion window
-- compiled the same conversation up to 3x (context call + two paste-uploads).
-- Keep rule: the EARLIEST record of each claim_text survives (the canonical compile);
-- later exact-text copies from OTHER sessions are duplicates.
-- Usage: psql/execute_sql with :workspace_id bound.

with ranked as (
  select id, session_id, claim_text, created_at,
         row_number() over (partition by claim_text order by created_at, id) as rn
    from claim_records
   where workspace_id = :'workspace_id'
)
select r.id as duplicate_record_id, r.session_id, left(r.claim_text, 90) as claim,
       (select count(*) from claim_conflicts cc
         where cc.claim_a_id = r.id or cc.claim_b_id = r.id)  as cited_by_conflicts,
       (select count(*) from claim_records s where s.supersedes_id = r.id) as superseded_by_refs
  from ranked r
 where r.rn > 1
 order by r.claim_text;
