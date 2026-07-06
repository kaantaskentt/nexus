# Sprint state — V2 (updated July 6, ~03:35 PT)

**DONE:** Railway live (nexus-api + nexus-worker, health verified, live pooler, EVAL_MODE off).
Design tokens-v2 + Snapshot rebuilt (drawer PASSED gate; card pattern in revision, 6 fixes).
Question Bank vendored + plan-generator/nexus-check rewired (33f22d4). #23 audit batch 1
filed + routed. #24 re-mine first pass done (Spine 9-slot req routed to #21).
**Backend lane COMPLETE + DEPLOYED (c57894c):** DEPLOYED PAIR LIVE = primary morning demo.
Vercel PROD promoted → https://nexus-v2-alpha.vercel.app (HTTP 200, V2). CORS+pooler proven
end-to-end (ACAO header + /api/workspaces 200 from prod origin). Railway api+worker redeployed
to HEAD (safety fixes + blue's workflows router 345d771). #22 live reseed (fixed non-atomic
wipe FK bug) + is_internal picker filter + em-dash cards recompiled clean (both DBs). #26 VAPI
provisioned + live-verified (2 warm assistants; NEXT_PUBLIC_VAPI_PUBLIC_KEY set for the widget).
#20 chat + refine + add-context, PLUS the safety closer: never_list attribution guard at BOTH
doors (refine reject + handoff strip, exact attack-string test), session_kind marking, grounding
flags. 52 backend tests green. Local api+worker restarted from HEAD (pids 9495/9494).
URLS: web https://nexus-v2-alpha.vercel.app · api https://nexus-api-production-d644.up.railway.app

**IN-FLIGHT:** frontend — card-pattern fixes then #19 replication (badge relabel spec-first
with prompts-evals). prompts-evals — terse-respondent persona fix (authorized, class-level,
bank→fix→fresh-verify), F38+ clinical audit queued, foreman run in background, volume held
until persona fix verifies. backend — QUEUE COMPLETE (see DONE); now on standing backlog
(polish/doc-truth) pending lead direction.

**NEXT (two backend opens, flagged to lead):** (1) round-2 re-drive on LIVE — the local
reseed wiped session 05ddebee, and live has only the founder session; re-drive Burak via the
committed driver so live ends with founder+Burak sessions + workflow + quality + gap linker RUN
(perception-gap slide). (2) /api/workflows serving fix — route 404s though the demo workspace
has a workflow (blue's #21 router, "rows invisible to serving paths"); blue reconciles. Frontend:
voice widget (frontend-2, has VAPI ids+key), #20 chat UI + #21 editor UI against live APIs.
