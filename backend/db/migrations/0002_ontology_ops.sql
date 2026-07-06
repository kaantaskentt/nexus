-- 0002_ontology_ops.sql — compiler/entity operational adjustments
-- Sources: docs/MERGE_PLAN.md Phase 1 · prompts/agents/stage4-compiler.md (kinds).
-- Rationale: the compiler emits four KINDS but only STATEMENT/CORRECTION carry a
-- trust tag. DIRECTIVE ("don't mention Harrods") and ADMISSION ("I don't know how
-- returns work") are not points on the trust ladder — the prompt says directives
-- get "no tag". Forcing a tag on them would pollute client trust displays, so tag
-- becomes nullable; topic stays required (always inferable). See docs/FOR-TUNC.md.

alter table claim_records alter column tag drop not null;

-- Sentiment quarantine is a data-layer invariant, not prompt discipline
-- (non-negotiable #4): any record carrying a person-sentiment flag is force-locked.
-- Defense in depth on top of the compiler's own split — a leaked judgment kills the
-- product, so the DB refuses to store an un-quarantined sentiment record.
create or replace function claim_records_quarantine_sentiment() returns trigger as $$
begin
  if new.sentiment_flag then
    new.quarantined := true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger claim_records_quarantine_sentiment_trg
  before insert on claim_records
  for each row execute function claim_records_quarantine_sentiment();

-- Name-matching support (entity registry): case-insensitive lookup of
-- call-mentioned names against the workspace people pool.
create index if not exists entities_name_lower_idx
  on entities (workspace_id, lower(canonical_name));
