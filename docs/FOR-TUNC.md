# For Tunç — what we changed and why

Short log so you can adapt your pipeline if you want to. Your architecture calls were mostly right — this build keeps your skeleton and trims the sprawl. Entries stay short on purpose; ask Kaan for the full plan (`docs/MERGE_PLAN.md`).

| # | Change | Why | If you adapt |
|---|---|---|---|
| 1 | Strong model (Claude Sonnet-class+) in compiler/interviewer/planner seats; cheap models only for chunking/scoring | Provenance showed gpt-4o-mini doing the hardest reasoning ungrounded — the root of most "agent feels dumb" reports | Your `agent_configs` table already supports this — it's a data update, no deploy |
| 2 | Findings → full claim records: `kind` (statement/directive/admission/correction), `topic` (8), `tag` (GUESS/CLAIMED/CONFIRMED), quarantine flags, `supersedes_id` | Typing decides what gets scored/committed/discarded at the root — replaces stacking generation filters | See `prompts/agents/stage4-compiler.md` — the ontology is fully specified there |
| 3 | Dropped Pinecone dependency | Your own architecture brief argues pgvector wins here (atomic KB commits) — the dep was drift | Delete `PineconeServices.py` + requirement; nothing else references it meaningfully |
| 4 | Dropped GCP (Firestore/Storage/BigQuery) + Firebase + S3 + ClickHouse; consolidated on Supabase (Postgres/pgvector/Storage) | 9 vendors → 6 for a 3-client PoC; fewer keys, consoles, and leak surfaces. Your instinct was scale-ready; ours is stage-appropriate — both are defensible, ours is cheaper to operate today | Keep yours if you're optimizing for scale; the schema is vendor-portable either way |
| 5 | "Candidate" split into three types: automation opportunity / knowledge gap / website suggestion | The conflation confused users and polluted pain scoring (website content scored as pain) | Rename follows the split naturally |
| 6 | Retrieval-grounding required: any generation claiming KB grounding must have non-empty `retrieval_queries` | Empty retrieval + generation = confident hallucination with an audit trail that says otherwise | Add a hard check in the agent runner |
| 7 | Voice layer (VAPI) on top of `run_interview_turn` | Your turn engine was transport-agnostic — good design; voice is a new entrance, not a rewrite | The webhook adapter pattern is in `backend/` once built |
| 8 | Interview invite tokens: expiry + single-session binding; "Mark Complete" skip removed; credential requests hard-blocked in plans | Security review items | Small patches, worth porting to your build as-is |

Add new entries below as the build proceeds. Three sentences max.
