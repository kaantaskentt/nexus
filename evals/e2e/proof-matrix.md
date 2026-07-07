<!-- Task #16 / proving-phase: full 5-persona agent-vs-agent matrix vs the REAL turn engine. A12 fictional.
     Committed as evidence. Each = interviewer(real) x respondent(sim), 8-10 turns, LLM-judged. -->

# Agent-vs-agent proof matrix — 5 respondent personas

| Persona | Style | Hidden surfaced | Traps taken | Stage 2 heuristics |
|---|---|---|---|---|
| jewelry-ops-manager | proud maker | 3/3 | 0/3 | h-jw-1=confirmed, h-jw-2=confirmed, h-jw-3=confirmed, h-jw-4=busted |
| hotel-frontdesk-lead | rambler/tangent | 3/3 | 0/3 | h-ho-1=confirmed, h-ho-2=confirmed, h-ho-3=confirmed |
| agency-account-manager | polished/hedger | 3/3 | 0/4 | h-ag-1=confirmed, h-ag-2=confirmed, h-ag-3=confirmed |
| bookkeeper | terse/hedger | 2/3 | 0/3 | h-bk-1=confirmed, h-bk-2=confirmed, h-bk-3=untouched, h-bk-4=busted |
| warehouse-foreman | skeptical/non-native EN | 3/3 | 0/3 | h-wh-1=confirmed, h-wh-2=confirmed, h-wh-3=confirmed |

**Totals: 14/16 hidden items surfaced · 0 traps taken across all five · every 'expect-BUSTED' prior correctly busted.**

## The one real gap (standing-loop candidate, NOT hotfixed)

- **bookkeeper H2** not surfaced: Filing deadlines and personal tracking sheet never mentioned in transcript.

**Diagnosis:** with the TERSE respondent (bookkeeper), the interviewer covered the workflow + the export-failure
objective but never routed to the deadline-tracking objective (H2), which the respondent — being terse — never
volunteered. So h-bk-3 came back `untouched`. This is an anti-under-probing / coverage-routing gap specific to
respondents who don't fill silence: the interviewer must drive to an untouched must-hit, not let a quiet
respondent's brevity end the topic. Corroborates the earlier read — over a full conversation the interviewer is
strong (episode-anchoring works, no traps), but coverage-routing with terse respondents needs firming. Per the
standing loop (EVALS.md §7) this becomes a regression case; per the no-reflexive-hotfix rule it goes to review first.

**Status update (July 6, terse fix 31f6f13) — verified on BOTH adapters, honest split result:**
The class-level terse fix ("brevity never satisfies a completion condition; a terse answer owes an exceptions probe +
a last-actual-episode anchor before a must-hit closes"; timelines/targets get the felt-vs-measured probe) landed in
stage7-interviewer.md. Direct adapter: the two motivating bookkeeper traps flip fail→pass, 27/27 tuning set, no
regression. **Real multi-turn engine (http, full 5-persona re-run against the EVAL_MODE server, this session):**

| Persona | Hidden | Traps | vs prior matrix |
|---|---|---|---|
| jewelry-ops-manager | 3/3 | 0/3 | same |
| hotel-frontdesk-lead | 3/3 | 0/3 | same |
| agency-account-manager | 2/3 | 1/3 | ↓ (ag-2 scope-creep untouched; took polished-non-answer — single-run variance) |
| bookkeeper (terse) | 2/3 | **0/4** | traps 3/3→0 vs the motivating disaster run; h-bk-3 still untouched |
| warehouse-foreman | 3/3 | 0/3 | same |
| **Totals** | **13/16** | **1 trap** | prior 14/16, 0 traps |

**What the fix DID do (real engine):** on the terse bookkeeper it drove traps to **0/4** (the motivating run took 3/3),
and the **target-vs-actual timeline probe fired** — H3 surfaced as *"usually wraps by day five or six; that one was more
like day eight,"* exactly the "a target is not the achieved reality" behavior. That is the fix working.
**What it did NOT do:** **h-bk-3 (deadline-tracking) is still `untouched`** on the multi-turn engine — the interviewer
still never routes to the must-hit the terse respondent won't volunteer. And **agency ag-2 (scope-creep) is the same
miss** on the polished persona. So the real residual is broader than terseness: **coverage-routing to a non-volunteered
must-hit** is not solved by the completion-condition principle — it likely needs an explicit "untouched must-hit → force
a direct probe before close" mechanism (model-side coverage tracking, ARCHITECTURE.md notes coverage is re-derived, not
computed). Correcting my earlier optimism: the fix is a real *partial* win (traps, timeline probe), NOT a close of h-bk-3.
Routed to the morning review as the standing coverage-routing item. Foreman mined clean (3/3, 0 traps, no new case).

## Computed coverage-routing (task #12 / morning-packet §5) — BUILT, A/B'd, shipped OFF by default

The §5 proposal: compute objective coverage server-side each turn (satisfied/partial/untouched) and
hard-gate the close on any untouched must-hit, driving one direct probe first. Built it in full:
`backend/app/pipeline/coverage.py` (a `coverage_tracker` classifier seat, migration 0008), wired into the
turn engine behind `config.coverage_routing`, deterministic gate logic unit-tested (`tests/test_coverage.py`,
6/6). It computes and fires live (agent_runs: `coverage_tracker` ok, ~3.4s/turn).

**But the A/B says it does not fix the motivating misses — and the proposal misdiagnosed them.** Same
container DB, two servers (old code 8002 = baseline, new code 8001 = coverage on), all judged by the same
harness this session:

*General runs (stage2 handoffs — where the miss is HIDDEN knowledge, not a stated objective):*

| Persona | H2 / target | baseline | coverage-on |
|---|---|---|---|
| bookkeeper (terse) | h-bk-3 deadline-tracking (hidden) | untouched, untouched (0/2 surfaced) | untouched, partial, untouched (1/3 surfaced) |
| agency (polished) | ag-2 scope-creep (hidden) | untouched | untouched |

*Targeted A/B (deadline-tracking made an EXPLICIT must-hit OBJECTIVE — what the gate is actually built for):*

| Run | probed the objective | H2 surfaced | h-bk-3 | hidden | traps |
|---|---|---|---|---|---|
| baseline #1 | yes | yes | confirmed | 3/3 | 0 |
| baseline #2 | yes | yes | confirmed | 3/3 | 0 |
| coverage-on #1 | yes | no | untouched | 2/3 | 0 |
| coverage-on #2 | yes | yes | confirmed | 1/3 | **2** |

**Root cause (evidence, not vibes):** h-bk-3 and ag-2 are *hidden-knowledge* items the plan never names as
objectives (by design — objectives shape questions, hidden knowledge is what good probing surfaces). A gate
that computes coverage of the *stated objectives* cannot force a non-objective to surface. And the moment you
DO make the item an explicit must-hit objective, the **baseline interviewer already routes to it and covers it
(3/3, both runs)** — the persona's in-head "track coverage silently / route to the highest-value unsatisfied
objective" (stage7-interviewer.md) already works for explicit objectives. So the computed classifier earns no
gain here, costs a model call per turn, and in this small sample was noisier (one coverage run took 2 traps).

**Disposition:** ship the mechanism dormant (built, tested, `coverage_routing=0`), not wired into the live
product on an unproven benefit (same discipline the packet's F38 wiring used). **The real lever for the
observed gap is plan-objective granularity** — have the plan generator emit the shadow-tool / deadline /
scope-creep dimensions as explicit sub-objectives; the baseline already covers explicit objectives, so richer
objectives close the gap without a turn-engine classifier. That is the smallest feasible next step, and it is
plan-generator work (with Emre's Q1/Q2 as the parallel technique calls), not turn-engine work.

## Plan-objective granularity (task #21) — the REAL lever, verified

Follow-on from the coverage-routing finding above: the fix is at the PLAN, not the turn engine.
Added a "Surface the hidden operational levers" section + hard rule 9 to `prompts/agents/plan-generator.md`
(domain-neutral categories: shadow tools, deadline/compliance tracking, scope-creep, manual re-keying,
single-point-of-knowledge; signal-gated, neutral, ranked, capped). Eval: `evals/plan/hidden-lever-objectives.yaml`
(SPEC-ONLY, judge-compatible, like leading-question-catch.yaml). Live A/B (old HEAD prompt vs new, same crafted
records, real model):

| Case | Old prompt | New prompt |
|---|---|---|
| bookkeeper records signal filing-deadline tracking (admission + a single-owner sheet) | topicizes a deadline objective (the record names it) | explicit **must-hit** "Filing Deadlines (Hidden Lever: single-point + deadline tracking)" with a resilience probe ("what if you are out two weeks") + an exception probe ("ever slipped") |
| retail control — NO lever signal in records | (n/a) | **no lever invented** — the plan self-documents "No signal, no lever: none were invented" |

Read honestly: when a record NAMES the lever, even the old prompt topicizes it; the new prompt's gain is (a)
generalizing to signals that are not on-the-nose (a stated target, an export step) via the named categories,
(b) the resilience/exception/single-point framing that makes the objective actually surface the hidden
knowledge, and (c) the signal-gated cap so it never manufactures a lever (control passed). **This closes the
causal chain from the coverage A/B:** records signal a lever -> plan emits it as an explicit must-hit -> the
interviewer already covers explicit must-hits at baseline (3/3, above). So plan granularity closes h-bk-3/ag-2
WITHOUT the turn-engine classifier. Full E2E before/after (plan -> handoff -> interview matrix) is blocked only
by the plan_generator seat not yet being wired into a pipeline (plan evals are SPEC-ONLY; the single-prompt
plan adapter is the next infra step, and it unblocks leading-question-catch.yaml too).

## Note for the FULL E2E (#15)
The agent-vs-agent driver exercises the synchronous turn engine only. The full
journey (compile → Phase-6 fan-out → report) also needs the QUEUE WORKER running (`python -m app.worker`) — per
backend/README, the API only enqueues; without the worker the compile/report never appear. #15 must run both processes.
## Round 3 (July 7) — coverage-routing A/B ON PROD: PARKED MID-RUN, credit exhaustion

Method: 5-persona matrix against the LIVE prod API (EVAL_MODE flipped on for the run,
A12-safe eval workspace), arm A = COVERAGE_ROUTING off (default), arm B = on. Runs in
`runs/r3A-*.json`. Arm A got 3/5 before the shared Anthropic account ran OUT OF CREDITS
(foreman sim died on the billing error; agency's prod-side turns hung into ReadTimeout —
same root cause; a direct prod turn then 500'd, confirming the turn engine itself was down).

**Arm A partials (flag OFF), single runs:**
| Persona | Hidden | Traps taken | Heuristics |
|---|---|---|---|
| jewelry-ops-manager | 3/3 | 0/3 | jw-1..3 confirmed, jw-4 busted (correct) |
| hotel-frontdesk-lead | 3/3 | 1/3 (closing "it just works" passed unprobed) | ho-1..3 confirmed |
| bookkeeper (terse) | 1/3 | 0/3 | bk-3 **untouched** again; bk-4 partial |

Read: the motivating terse-respondent coverage gap REPRODUCED on prod at baseline
(h-bk-3 deadline-tracking untouched, H2+H3 unsurfaced this round — worse than round 2's
2/3). That is exactly the evidence arm B exists to answer. Hotel's taken trap is new
(round 2 was 0/3) — single-run variance vs. real regression, undecidable at n=1.

**To resume once credits are topped up** (blocked, Kaan-only unblock):
1. re-create an eval admin (scripts/create_admin.py), set EVAL_MODE=1 on nexus-api;
2. finish arm A: agency-account-manager + warehouse-foreman (run ≤2 concurrent — 5-way
   parallel caused adapter ReadTimeouts even before the credit wall);
3. arm B: COVERAGE_ROUTING=1, same 5 personas, same method;
4. restore EVAL_MODE=0 + unset COVERAGE_ROUTING, delete the eval admin;
5. decision table for Kaan/Emre: does the per-turn classifier close bk-3/H2 on the terse
   persona (and ag-2 on the polished one) without hurting the clean personas?
State restored at park: EVAL_MODE=0 live, eval admin deleted, no flags left flipped.
