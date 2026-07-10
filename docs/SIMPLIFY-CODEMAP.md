# SIMPLIFY — Codebase Map (read-only recon, do not commit)

Purpose: honest file map for the surfaces the SIMPLIFY sprint touches, so the plan can
state codebase impact. "Company" = `workspaces` row throughout. Backend is FastAPI
(`backend/app`), frontend Next.js app-router (`frontend/src`). Biggest files flagged for
rewrite-vs-edit. Line refs are from the current `main`.

## Biggest files (rewrite-radar)
Frontend: `lib/live.ts` 967 · `plan/PlanView.tsx` 767 · `snapshot/DiscoveryUpload.tsx` 676 ·
`workflow/WorkflowEditor.tsx` 639 · `snapshot/SnapshotView.tsx` 571 · `interview/VoiceCall.tsx` 547 ·
`interview/InterviewClient.tsx` 515 · `report/ReportView.tsx` 503 · `interview/ObserverView.tsx` 465 ·
`insights/InsightsView.tsx` 414 · `knowledge/KnowledgeBaseView.tsx` 397 · `plan/SendInterviewFlow.tsx` 374.
Backend: `routers/workspaces.py` 690 · `routers/plans.py` 439 · `pipeline/compiler.py` 395 ·
`pipeline/interview.py` 312 · `pipeline/workflow_edit.py` 292 · `routers/voice_config.py` 263.

---

## Area 1 — Workspace picker, reorder + delete-company cascade

**Frontend**
- `frontend/src/app/page.tsx` (232) — the picker. `Home()` server component: `list_workspaces()`
  → per-ws `list_plans` + `list_snapshot_cards` for counts. **Ordering is hardcoded**: backend
  returns `created_at` ASC, page does `[...withCounts].reverse()` (L47) for newest-first;
  `hero` = newest prepared non-demo (L50). `HeroCard`/`Meta`/`NodeGraph` are local.
- `frontend/src/components/AddCompany.tsx` (219) — "Add company" form → POST create.
- `frontend/src/components/AppShell.tsx` `WorkspaceSwitcher` (L252) — the other place the ws list renders.

**Backend / model**
- `backend/app/routers/workspaces.py` — `create_workspace` (L58) POST `""`; `list_workspaces`
  (L85) GET `""` `order by created_at`, filters `is_internal=false`, client-seat sees only its own.
- **No ordering column** on `workspaces` (migration 0001 L11-19: id/name/slug/industry/is_demo/config/created_at
  only — reorder needs a new `sort_order`/`position` col + PATCH endpoint, both net-new).
- **No delete-workspace endpoint exists** (grep `@router.delete` in workspaces.py → none). Only
  interview-session delete exists (`routers/sessions.py` L229 + `pipeline/deletion.py`).

**Company-delete cascade — what hangs off a workspace** (migration 0001 + later): tables with
`workspace_id` FK, almost all **without `on delete cascade`** (would need explicit teardown or
new cascade FKs): `entities`, `interview_rounds`, `interview_plans` (→ `plan_state_transitions`,
`handoff_packages`), `interview_sessions` (→ `utterances`, `claim_records`, `artifact_promises`,
`roleplay_debriefs`, `observer_insights`, `agent_runs.session_id`), `scrape_sources`,
`claim_records` (→ `pain_scores`, `claim_conflicts`, embeddings), `heuristics`, `snapshot_cards`,
`workflows` (→ `workflow_steps`, `workflow_step_overlays`, `workflow_sops`). Later migrations that
DID add `on delete cascade`: `voice_config` (0009), `report_shares` (0018), `user_roles` (0019),
`artifact_promises` (0016), `automation_opportunities` (0017), `sealed_flags` indirectly (0011).
The existing `pipeline/deletion.py` `delete_interview` (L105) is the template for ordering a manual
cascade in one transaction; a company-delete is that, one level up, over all the above.

## Area 2 — Home / snapshot + "first context call completed" detection

- `frontend/src/app/w/[slug]/home/page.tsx` (79) — `HomePage`, `force-dynamic`. Branch: **`cards.length===0`**
  (no compiled snapshot cards) → `DiscoveryUpload` guided state; else `SnapshotView` + optional
  `WeeklyPulseCard` + `AddTranscriptDoor` (L69-77). "First context call completed" ≈ **first
  `snapshot_cards` row exists for the ws** (a `context`/discovery `compile_session` with
  `render_snapshot=true` renders cards on round complete — `sessions.py` L157). So the post-call
  intro page precedes the `cards.length>0` branch.
- Render batching: `snapshot_cards.render_batch` + append-only per round (A3); cards carry
  `card_type` (`learned`/`area_to_investigate`/`suggested_person`/`conflict_point`) + `confidence`.
- Session kinds live on `interview_sessions.session_kind` (`interview`|`context`|`eval`, + `voice_test`/`roleplay`
  added in 0014/0015/0020). `context` = the CEO/discovery call (plan-less).
- Components: `snapshot/SnapshotView.tsx` (571), `snapshot/DiscoveryUpload.tsx` (676),
  `snapshot/AddTranscriptDoor.tsx` (49), `snapshot/WeeklyPulseCard.tsx` (74).

## Area 3 — Workflows list + detail/editor + data model

- List: `frontend/src/app/w/[slug]/workflows/page.tsx` (77) — `get_workflows(ws.id)`, one row/workflow,
  shows `w.step_count`. **No department/category chips today** (nothing to group by — see model).
- Detail route: `frontend/src/app/w/[slug]/workflow/[id]/page.tsx` (49) → `WorkflowEditor` with
  `?from=`/`?panel=sop`/`?highlight=` handling.
- Editor: `frontend/src/components/workflow/WorkflowEditor.tsx` (639) — the redesign target.
- Backend: `routers/workflows.py` (125) — `list_workflows` (L29), `effective` (L56, folded base+overlays),
  `edit` (L72), `sop` (L93/102), `blueprint` (L119). Build: `pipeline/workflow.py` `build_workflow_schema`.
  Edit ontology: `pipeline/workflow_edit.py` (292) — `effective_workflow`, `apply_op`, `blueprint`.
- **Data model** (migration 0001 `workflows` L245 + `workflow_steps` L258): workflow has
  `name`, `session_id`, `workspace_id` only — **no department/category field, no confidence field**.
  Steps: `step_index`, `tool`, `action`, `input`, `output`, `verified` (`verified`|`partial`|`unverified`),
  `spine_slots` (9 A10 slots incl. **`exceptions`**, `trigger`, `rules`, `success`, `examples`),
  `slot_scores` (0/1/2 per slot), `claim_ids`. Overlays in 0006: `workflow_step_overlays`
  (ops `reorder`/`rename`/`annotate`/`add_manual`/`soft_hide`/`unhide`), `workflow_sops`.
  → Adding department/category or a workflow-level confidence is **net-new schema**.

## Area 4 — Respondent consent/welcome (/i/[token]) + done page + per-kind copy

- Route: `frontend/src/app/i/[token]/page.tsx` (9) → `InterviewClient`.
- `frontend/src/components/interview/InterviewClient.tsx` (515) — phases `loading|load_error|consent|chat|paused|done`.
  `ConsentLanding` (L442) renders consent copy; `done` phase (L212) is the completed page (+`PromisedArtifacts`).
  BETA "Context call" chip in `Shell` (L420) when `session.context_call`.
- **Copy source**: `frontend/src/lib/respondent.ts` `consentCopy()` (L142) — single generic-but-honest
  copy block for ALL kinds, merge-fields degrade gracefully. There is **no per-session-kind branching
  in the copy today** (context vs interview both use the same `consentCopy`); the only kind signal is
  `context_call` (BETA chip) + `test_back_path`. Backend context: `routers/sessions.py`
  `_consent_context` (L36) sends `topic/company/respondent_first_name/est_minutes` — topic is plan-neutral.
- Done-page copy is inline in `InterviewClient` L219-227.

## Area 5 — Live room (voice + text), reconnect, VAPI, live extraction, text-turn latency

- Voice: `frontend/src/components/interview/VoiceCall.tsx` (547) — real VAPI web call. State machine
  `idle|connecting|live|ended|dropped|error` (L39). Orb/waveform/transcript driven by real VAPI
  events (`volume-level`, `speech-start/end`, `message`/transcript L192). **Reconnect**: `dropped`
  vs `ended` distinction (L172-178), mic preflight (L151) + mic watchdog (L262) for the silent-drop
  signature, resume `firstMessage` (L55). Assistant ids hardcoded fallback (L30). Sub-components:
  `ParticleOrb.tsx` (166), `MicWaveform.tsx` (100), `LiveTranscript.tsx` (95, renders real turns),
  `InterviewProgress.tsx` (104, neutral time/state — never a claims ticker, A18).
- Text: `InterviewClient.tsx` chat branch (L264+). Voice↔text share ONE server session/transcript;
  `switchToText` re-pulls (L81). `lib/respondent.ts` client: `takeTurn`, `getSession`, etc.
- Backend voice wiring: `routers/voice.py` (187) — VAPI custom-LLM `/chat/completions` (L99) +
  `/webhook` (L118); `vapi_assistant.py` (207); `routers/voice_config.py` (263) per-ws assistant/voice.
- **Text-turn latency path** (per turn): `POST /api/sessions/by-token/{token}/turn` (`sessions.py` L112)
  → `run_interview_turn` (`pipeline/interview.py` L221) → `_prepare_turn` (L82): fetch session+ws join,
  insert respondent utterance, fetch all utterances, `_load_package` (handoff fetch or build), optional
  `coverage.compute_coverage` (**an LLM call, default OFF** via `coverage_routing`), deterministic
  `attention.detect_fade` → then `run_chat` (the interviewer LLM call) → `_finalize_turn` inserts agent
  utterance + updates `resumable_state`. So baseline latency = 1 LLM call + a handful of queries.
- **Live claims/insights**: there is **NO live extraction today**. Claims are produced only
  post-compile (Stage 4 `pipeline/compiler.py`, enqueued at finish). The Observer's live "insights"
  are **manually admin-typed** (`routers/observer.py` `add_insight` L121 → `observer_insights` table,
  0010). A "Captured-live" panel would be net-new (either stream from utterances or a new live
  extractor). Observer view: `interview/ObserverView.tsx` (465) — polls `observe_session`, `InsightRail`
  (L326), `TopicsCovered` (L210), `CoverageRing` (L290).

## Area 6 — Interviews hub (plans list, plan detail, observe, report, follow-up, plan-chat)

- Hub list: `frontend/src/app/w/[slug]/interviews/page.tsx` → `interviews/InterviewsView.tsx` (211) —
  sessions list, status pills, per-row **Observe / View report / Delete** (`DeleteInterviewDialog.tsx` 154).
- Plans index: `app/w/[slug]/plans/page.tsx` (180) + `CustomPlanDoor.tsx` (125).
- **Plan detail (the messy one)**: `app/w/[slug]/plans/[id]/page.tsx` (31) → `plan/PlanView.tsx` (767).
  PlanView holds: `StatusTracker` (L736), mission panel (goal/known_context/topics/DoD/handling), the
  `RefinePlan` chat (L640, posts `refine_plan` → server `change_log`), NEXUS_CHECK flags render (L444),
  the whole approve→check→send→revoke bottom action bar (L492), disabled "Generate Follow-Up Template"
  (L586). Send flow: `plan/SendInterviewFlow.tsx` (374). This is the single densest client file in scope.
- Observe: `app/w/[slug]/interviews/[id]/page.tsx` → `ObserverView.tsx` (see Area 5).
- Report: `app/w/[slug]/report/[id]/page.tsx` (35) → `report/ReportView.tsx` (503) — `StepDetailDrawer`
  (L394), `Cross-Interview Conflicts` (L144), `ArtifactsPanel.tsx` (147), `ReportLoader.tsx` (74).
- Backend: `routers/plans.py` (439) — list/generate/redraft/transition/send/`refine-chat` (L338, applies
  bounded edits + writes `change_log`); state machine `plan_state` enum (12 states, migration 0001 L52);
  `reconcile_plan_state` (L92). `routers/reports.py` (173), `routers/observer.py` (137).
  **change_log** is a jsonb column on `interview_plans` (0001 L79); refine-chat appends to it; PlanView
  reads the latest `nexus_check` entry's `flags` (L76-84).

## Area 7 — Simulations + play-this-character (raw MD render)

- Page: `app/w/[slug]/simulations/page.tsx` (167) — explainer + product-wide `history` (cast + proving
  rounds) + this-ws `runs`. No "Run" button (proposed only, honest v1).
- `frontend/src/components/simulations/RolePlaySection.tsx` (251) — F8 "Play this character": cast cards,
  `play()` mints a roleplay session + fetches brief, **raw MD renders in a `whitespace-pre-wrap` box**
  (L231, the `{brief}` — this is the raw-markdown surface the sprint wants carded), debrief list.
- Backend: `routers/simulations.py` (120) — `roleplay` start (L40), `roleplay/personas/{key}/brief` (L60),
  `debrief` (L102); `pipeline/roleplay.py` (106); `simulation_history.py` (99). Roleplay sessions are
  `session_kind='roleplay'` (0020), firewalled from compile/screening.

## Area 8 — Shared design system

- `frontend/src/components/AppShell.tsx` (328) — nav shell: `NAV` array (L38), `SEG_TO_NAV` highlight map
  (L56, note **skills folds into workflows** L67), breadcrumbs (L207), `WorkspaceSwitcher` (L252). Sole
  nav chrome; every screen renders inside it via `app/w/[slug]/layout.tsx` (44).
- Motion: `frontend/src/lib/variants.ts` (43) — `rise`, `staggerParent`, `drawerSpring`, `scrimFade`,
  `drawerSection`. `useEscapeClose` hook used by drawers/dialogs. `lib/cn.ts` classname merge.
- Badge/chip primitives: `ConfidenceBadge.tsx` (80), `PlanStateChip.tsx` (64), `PainBandChip.tsx` (33),
  `DiscoveryTag.tsx` (31), `MustHitDot.tsx` (35), `EvidenceQuoteCard.tsx` (69), `StepRail.tsx` (95),
  `PersonRow.tsx` (45). Card primitive is a Tailwind pattern (`card-hairline rounded-card border
  border-line bg-surface`), not a component — repeated inline everywhere. Design tokens (`accent`,
  `ink`, `surface`, `pain-*`, `tag-*`) live in `globals.css`; no ts token file.
- Tests pinning behavior: `src/test/badge-mapping.test.tsx` (208), `observer-badges.test.tsx` (128),
  `interview-progress-neutrality.test.tsx` (73, pins A18 neutral progress), `voice-settings.test.tsx`,
  `generate-plan-button.test.tsx`, `context-chat.test.tsx`, `transcript-speakers.test.ts`.

## is_demo / is_internal coupling (touch carefully)
`is_demo` (A12 firewall) + `is_internal` (0007, hides eval/e2e/voice tenants from picker) appear in:
`page.tsx` (hero guard skips demo, L50), `AddCompany.tsx`, `lib/types.ts`, `lib/live.ts`,
`routers/workspaces.py` (list filters `is_internal=false`, create forces both false),
`routers/sessions.py` (eval-bootstrap mints is_demo+is_internal), `config.py`. Any company-delete or
reorder must preserve the `is_internal` picker filter and the `is_demo` hero guard.
