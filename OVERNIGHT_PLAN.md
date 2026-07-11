# OVERNIGHT PLAN — July 10→11 night session (goes live tomorrow)

Orders: docs/NIGHT-ORDERS-JUL10.md. Status legend: ☐ pending · ▶ in progress · ✅ done+verified · ⏸ deferred (reason given).
Updated after EVERY completed item. Proofs driven on Test Mest (aeb5eed8-dd5c-4e00-af1b-490f44d43bde) unless stated.

---

## PHASE 1 AUDIT — the three answers (evidence in place, no code written yet)

### 1. What is dead vs load-bearing?
Dead-code sweep running (results appended to §P2 below before any cut). Verified load-bearing
so far: every router in main.py is registered; pipeline fan-out jobs all have enqueue callers.
Confirmed junk at repo root: stray PNGs (walk-1-home-empty.png, aurora-empty-state.png,
lanemest-*.png, seam2-*.png), untracked scripts/. Verdicts + cuts land in P2.

### 2. Which feedback items are quick wins vs structural?
QUICK WINS (each ≤1h, isolated): WS-7 NEVER-list render (PlanView omits `plan.never_list`
entirely — verified missing); WS-12 empty-session no-op (c329cca only wrote the docs note —
`compiler.py:205` still raises); WS-5 named provider error (single choke point: llm.py +
queue.py + health/deep + AppShell banner); worker concurrency (SKIP LOCKED already supports
N loops); compile idempotency guard; interviews-list pollution filter; idle-session
auto-complete sweeper; live-capture extractor model right-size.
STRUCTURAL: WS-2 refine rewrite (root cause: `_REFINE_TARGETS` in routers/plans.py:47 only
allows never_list/questions/handling_notes — the output contract literally tells the agent
"express it as a handling_note", which IS the PLAN REBUILD NOTE bug); WS-1 smart-prep
(prompt stance + new schema packet at handoff build + hypothesis pre-reads + safety re-run);
WS-6 dedupe (staged, confirm-before-destructive).

### 3. Top 3 causes of slowness (measured, agent_runs last 3 days)
1. **The worker is strictly serial** — one process, one job at a time. Compile p95 176s,
   snapshot p95 172s; every compile fans out 7 more jobs that queue BEHIND anything slow.
   This is also why Berk's live-capture counter lagged and reports appear "unreachable"
   minutes after completion. Fix: N concurrent worker loops (queue is SKIP LOCKED-ready).
2. **Admin-visible sequential LLM chains**: plan = generate (avg 26s) → nexus_check (17s)
   → handoff; snapshot render is one giant output-bound call (avg 68s, avg_out 4744 tokens).
3. **Failure retry storms during provider outages**: 21/37 plan_generator runs errored July
   8-10; failed jobs retry on a blind 30s backoff with no named cause (WS-5), so the queue
   thrashed and everything above got slower.
Token waste found: single-shot `run_agent` path has NO prompt caching (interview turns have
it; compiler/plan/snapshot don't); highest-volume agent (live_capture_extractor, 93 runs) is
on Sonnet for display-only extraction. Interviewer turn path is healthy: p50 2.7s, cached.

### Baseline numbers (before) — agent_runs, July 8-10
| seat | runs | p50 | p95 | avg in→out tokens |
|---|---|---|---|---|
| interviewer turn | 71 | 2.7s | 6.8s | 3707→78 |
| stage4_compiler | 26 | 13.9s | 176s | 7066→3484 |
| snapshot_renderer | 25 | 34s | 172s | 5567→4744 |
| plan_generator | 37 | 0.4s* | 69s | 6306→2931 (*21 errored fast) |
| nexus_check | 18 | 12.6s | 37s | 3779→728 |
| live_capture_extractor | 93 | 1.5s | 5.2s | 1440→50 |

---

## P0 — broken, or promised-and-missing (execution order)

### ☐ WS-2 REFINE-REWRITE — refine must rewrite topics/goal/DoD, not append notes
Root cause verified: `_REFINE_TARGETS = {never_list, suggested_questions, handling_notes}`
(routers/plans.py). Topics/goal/definition_of_done are structurally uneditable; the contract
tells the agent to shove real edits into handling_notes → "PLAN REBUILD NOTE" → stale DoD
drove the stupid-questions cluster (addendum §4 cause 1).
FIX: extend refine targets with `topics` (add/remove), `goal` (set), `definition_of_done`
(add/remove/set). change_log already records before/after per applied change = the audit
trail underneath. A material change (topics/goal/DoD) while AWAITING_APPROVAL re-enqueues
nexus_check so the reviewer validates the EFFECTIVE plan, never a stale one. Handoff is
rebuilt at send (verified: send_interview calls build_handoff_package synchronously) so the
runtime package always matches the rewritten plan.
Verify: unit tests + driven refine on a Test Mest plan (retire a must-hit → visible topics
change + DoD rewritten + change_log entry + re-check ran).

### ☐ WS-3 ENTITY-BLEED — thin records about the person → say so, never borrow
Site: pipeline/plan.py generate_plan (records block is workspace-wide, no person scoping).
FIX: count records mentioning the person (subject_id = entity OR claim_text ~* name). If
below threshold: inject an explicit THIN-RECORDS instruction (draft a lean plan, mark
records_thin=true on the mission, add operator questions; NEVER borrow another person's
role/duties/handling notes) + prompt-side rule in plan-generator.md. UI: PlanView renders a
"records are thin for this person" notice from mission.records_thin.
Verify: regenerate an Ahmet-class plan (vague mission, thin records) on a driven workspace →
plan says records are thin, zero CEO-duty must-hits.

### ☐ WS-7 NEVER-VISIBLE — render the NEVER list on plan review (quick win, do with WS-2)
Verified missing: PlanView renders goal/known_context/topics/DoD/handling_notes; never_list
is never rendered. FIX: NEVER-list section on the review surface ("outranks every
objective"), from plan.never_list + a note that directive records join at handoff time.
Verify: screenshot on prod plan with a NEVER entry.

### ☐ WS-1 SMART-PREP — BCG-level stance + pre-call schema (after WS-2/3; safety evals re-run before push)
a) stage7-interviewer.md stance fix: new section — ASSUME domain competence (the model knows
   every business domain; never ask a professional to define their profession's basics;
   verify the company-specific instantiation like a sharp consultant peer). Verified gap:
   no such stance exists anywhere in the prompt today.
b) Pre-call SCHEMA packet (Emre: schema, NOT hypothesis): at handoff build, one small LLM
   call builds a compact industry/role schema (process areas, tools, table-stakes practices
   for THIS role at THIS kind of firm — the territory, never guesses about this company).
   Stored on the package as `industry_prime`, rendered in the stable cached prefix. Hard cap
   ~350 tokens (P1 conflict otherwise). Non-negotiable #2 holds: schema derives from
   role+industry, never from anyone's statements.
   NOTE: {{INDUSTRY_CALIBRATION}} today only has 4 static example files (jewelry,
   hospitality, accounting, agency) — Test Mest (data science consulting) injected EMPTY.
   The schema packet closes exactly this hole per-role instead of per-industry-file.
c) Pre-reads become HYPOTHESES: handling-note register pre-reads explicitly overridable by
   live evidence; shift on the FIRST irritation signal (folds WS-10's register rule in).
Safety gate: re-run disclosure/fixed-response/scope-lock/anti-fluency evals BEFORE push
(§4 of night orders binds; frugal runs).

### ☐ WS-4 LIST-TRUTH — three verified sub-bugs
a) **No auto-complete**: text interviews only complete via the Finish click. Ahmet's session
   (34b8f7da) is STILL active/uncompiled on prod — his records never compiled (Emre's "both
   compiles ran" was the two CEO paste-sessions). FIX: idle-session sweeper job (active +
   last_turn_at stale → complete + compile, self-rescheduling); plus complete stays
   idempotent. Then drive Ahmet's session to completed → his report becomes reachable.
b) **List pollution**: discovery paste-sessions default session_kind='interview' → phantom
   "CEO" rows + wrong counters in the Interviews list. FIX: exclude plan-less+invite-less
   sessions from the interviews list query.
c) **Respondent counter read 0** (R1 count surface): endpoint verified live NOW (returns 14
   for Berk); poller silently masks fetch errors as 0. Driven repro required; fix what it
   shows (candidate: silent catch + error state, plus checking counter actually ticks
   mid-interview on prod).
Berk's "missing report" self-resolved once the serial queue caught up (workflow row landed
20:47) — the durable fix is worker concurrency (P1) + (a).

### ☐ WS-5 LOUD-EMPTY-TANK — named provider-credit error end to end
Worker catches everything generically; agent_runs shows the outage as 21 anonymous errors.
FIX: llm.py classifies anthropic errors (credit/auth/rate-limit/overloaded) into a typed
ProviderError; queue writes `PROVIDER_CREDITS_EXHAUSTED: …` into last_error with a longer
backoff for credit errors; /health/deep gains provider_error fields; AppShell shows an
admin banner ("AI provider credits exhausted — work is queued and resumes after top-up").
Verify: unit test with a faked 400 credit error + banner render + health/deep fields.

### ☐ WS-6 DEDUPE-SWEEP — report first, staged deletions, reversible
Evidence (prod): Test Mest 185 records, 139 distinct texts. The 57→143 jump = the SAME
conversation compiled 3× — context call bcd1385e (57 recs) + two paste-sessions 001ee881
(38) + cdb756a8 (49) created 5 min apart during the outage, identical claim texts across
all three. dupes within a single session: 0.
PLAN: (1) read-only dedupe report script (any workspace: same/near-identical claim_text
across sessions, grouped, counts); (2) staged deletion list written HERE for the two paste-
sessions' duplicate records (exact-text matches only); (3) add compile idempotency guard
(records already exist for session → no-op unless force) so retry storms can never
duplicate again. Deletions only after the staged list is reviewed — records are the product.
STAGED DELETION LIST: (to be filled by the report step — nothing deleted yet)

## P1 — performance and cost

### ☐ P1-1 Worker concurrency — N loops on the SKIP LOCKED queue
worker.py runs asyncio.gather(worker_loop×4, distinct worker_ids). Kills the head-of-line
blocking behind slow compiles/snapshots (top slowness cause #1). Verify: parallel job claim
test locally + prod queue drain observed.

### ☐ P1-2 Prompt caching for single-shot seats
run_agent gains cache=True per-seat for big stable system prompts (compiler 13KB, plan
generator, snapshot renderer, context collector). Same 5m ephemeral pattern the turn engine
already uses. Verify: cache_read tokens visible on agent_runs after a driven compile.

### ☐ P1-3 Right-size live_capture_extractor → Haiku
Highest-volume seat (93 runs/3d), output is display-only counters/labels (never claim
records — "not the KB" by design). Non-negotiable #7 untouched (not a demanding seat).
Also makes the respondent counter tick faster. Verify: eval-workspace extraction sanity +
prod driven turn. Other seats (pain_rater, artifact_promise_scan) PROPOSED only — listed
for Kaan, not changed tonight (they write product-visible data).

### ☐ P1-4 Before/after numbers recorded here after P1-1..3 land.

## P2 — dead code removal (each cut: build + test + smoke, own commit)
☐ Sweep results pending (agent running) — verdict list lands here before any cut.
Known: repo-root stray PNGs → docs/screenshots/; untracked scripts/ → inspect then decide.

## P3 — polish
### ☐ WS-10 REGISTER-SHIFT (into stage7-interviewer.md with WS-1 — single safety-eval run):
never repeat a source-probe verbatim · first-irritation register shift · bus-factor closer
promoted to explicit playbook ([B8]) · [A5] capture-side missed-probe follow-up · [B7] no
stacked questions under time pressure.
### ☐ WS-11 EVAL-MINE: add [A5], [B7], [A9], identical-repeat-probe cases to the eval suite
(FRUGAL — assertions on transcripts where possible, minimal live runs).
### ☐ WS-12 SMALLS: empty-session compile no-op (verified NOT shipped — c329cca was docs-only)
· send-modal voice re-assert + email carry-over (wiring exists, Emre still hit it — driven
repro then fix) · B6 conflicts-view check (data layer VERIFIED: 4 perception gaps + 3
ceo_vs_floor conflicts on the notebook contradiction landed 20:49-20:50; remaining check is
whether the insights/conflicts VIEW renders them — they carry render:"report-only").

## Round-3 prep (leave ready, do not run)
Ayse plan approved+waiting (untouched) · worker reports reachable (falls out of WS-4a) ·
conflicts view check (WS-12) · dedupe verification (WS-6 report).

---

## Commit ledger (append per commit)
(none yet)
