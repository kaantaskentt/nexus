# Sprint state — V2 FINAL (July 6, ~04:00 PT)

**PROD IS LIVE AND PRIMARY:** https://nexus-v2-alpha.vercel.app (V2 frontend, voice-capable)
+ https://nexus-api-production-d644.up.railway.app (api+worker at HEAD c7d8f09: safety
guards, session_kind, workflows router+list route, SOP jobs). CORS+pooler proven from prod
origin. Local :8000 stack restarted at HEAD (fallback). Both DBs reseeded em-dash-clean.

**DONE (all of V2 #18–#26):** design system + 6 surfaces + 3 glass flagships (AreaDrawer,
step drawer, workflow editor) · every-button-works + honest disabled microcopy · badge
system per frozen glossary (Verified/High/Reported/Scraped + tooltips) · em-dash rule
closed-loop (copy, prompts, generated output, seeds, lint, sync test) · #20 chat/refine
APIs with both-doors never_list guard (attack-string tested) · #21 overlays/SOP/Blueprint
backend live + editor UI built · #22 full deploy · #23 audit · #24 re-mine (Question Bank
vendored, spine 9-slot fix) · #25 volume (13/16, 1 trap; terse fix partial win) · #26 VAPI
provisioned + widget deployed (ff9ba48). 52 backend tests, 23 frontend tests, suites green.

**OPEN (1 verification item):**
1. ~~Editor live-verify~~ CLOSED July 6 morning by qa-prod: PASS on all 4 ontology rules
   against prod (overlay provenance, MANUAL tagging, reversible soft-hide, audit trail);
   11 screenshots committed (5162cac). #21 done. Found in the process: Next data-cache
   staleness in api.ts (SSR renders stale on every surface) — urgent fix in flight (#13).
2. ~~Perception-gap verdict~~ CLOSED July 6 morning by qa-prod: 2 ceo_vs_floor gaps form
   in conflict_points on LIVE (perception_gaps[] stays empty — UI wired to the right
   field). Boutique-count gap = confirmed FALSE POSITIVE (comparator used the CEO's
   self-retracted claim); yıldırım gap = real. Same-speaker-retraction exclusion rule
   proposed to Emre in morning packet §6 — nothing patched pending his F21/F41 call.

**MORNING SHIFT (July 6): PROD REDEPLOYED at 84db7fe (~09:55 PT).** Vercel (clean-worktree
build) + both Railway services SUCCESS. Live now: admin login (Supabase Auth, /w/* gated,
/i/* public) · Knowledge Base + Insights + Interviews nav (all 6 items live, Overview
removed) · New Company flow + CEO transcript upload → progressive snapshot (A17, E2E-proven
with real LLMs) · optional website scan · cache-staleness fix · silent parse-swallow fix
(AgentParseError + raw output persisted) · migration 0008 applied to live (coverage_routing
built, OFF pending Kaan). MORNING-ORDERS all 4 priorities closed or in final pass.
In flight: qa-prod re-verify sweep + #18 fresh-journey acceptance; #14/#15 report fixes +
#23 JSON-format constraints ride a second backend deploy; then #24/#25 leg re-runs +
em-dash re-compile on the demo tenant; frontend-1 on premium pass round 2.
Comparator same-speaker-retraction rule + coverage-routing feel change: packet §5/§6, Emre/Kaan.

**MORNING (Kaan):** open the prod URL · FIRST VOICE CALL (send a voice-modality interview
from Burak's plan, respondent page shows "Start voice conversation") · morning-review
packet evals/adjudication/morning-review-packet.md (blind golden labeling, Q1-Q3, F38+
proposals, TOP V3 item: computed coverage-routing) · taste veto batch (V2-PLAN + earlier
7-item list; badge labels + em-dash-exemption ruling logged as named deviations) · Artifact
(same URL, V2 section; editor frames pending item 1).
