# Sprint state — V2 (updated July 6, ~03:35 PT)

**DONE:** Railway live (nexus-api + nexus-worker, health verified, live pooler, EVAL_MODE off).
Design tokens-v2 + Snapshot rebuilt (drawer PASSED gate; card pattern in revision, 6 fixes).
Question Bank vendored + plan-generator/nexus-check rewired (33f22d4). #23 audit batch 1
filed + routed. #24 re-mine first pass done (Spine 9-slot req routed to #21).
**Backend lane queue COMPLETE (c77d6af):** #22 live reseed done (found+fixed non-atomic
wipe FK-order bug in seed_demo); Railway redeployed to HEAD (api+worker on new code);
Vercel PREVIEW deployed + public (brand.json cross-dir solved via committed synced copy) —
prod promotion is one `vercel --prod` once frontend tree is clean. #26 VAPI provisioned +
live-verified (2 warm assistants, authed custom-LLM turn streams a real opener). #20 chat
(ask+add-context CLAIMED-cap+suggestions), refine-chat (bounded machine rules+change_log),
consent parity test, spine now emits full 9 slots — all live-verified, 45 tests green.
URLS: api https://nexus-api-production-d644.up.railway.app · web (preview)
https://nexus-v2-1gwochyjj-kaantaskentts-projects.vercel.app

**IN-FLIGHT:** frontend — card-pattern fixes then #19 replication (badge relabel spec-first
with prompts-evals). prompts-evals — terse-respondent persona fix (authorized, class-level,
bank→fix→fresh-verify), F38+ clinical audit queued, foreman run in background, volume held
until persona fix verifies. backend — QUEUE COMPLETE (see DONE); now on standing backlog
(polish/doc-truth) pending lead direction.

**NEXT:** frontend to reach a clean tree → promote Vercel preview to prod (`vercel --prod`)
for the stable morning URL; wire the Vercel web SDK voice widget on the interview page
(assistantId + metadata.session_token) to finish #26's callable landing; build the #20 chat
UI + #21 workflow-editor UI against the now-live backend APIs. persona fix verification
gates volume resume; card grid re-shoot gates #19.
