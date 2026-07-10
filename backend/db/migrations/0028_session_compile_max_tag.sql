-- ANYTIME-CONTEXT (the knowledge-engine loop): an ADDITIVE context call (a workspace that
-- already had a context call) caps its compile at CLAIMED — a founder's own single account is
-- CLAIMED, never CONFIRMED, matching the ADD-4 intake precedent and the non-negotiable that one
-- person's account never compiles above CLAIMED. Set at MINT on additive context calls; the
-- compile reads it. NULL = uncapped, so the FIRST context call keeps its tested CONFIRMED
-- behavior unchanged (A24 presumption of correctness). Nullable, additive, no backfill.
alter table interview_sessions add column if not exists compile_max_tag text;
