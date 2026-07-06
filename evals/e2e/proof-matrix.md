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

## Note for the FULL E2E (#15)
The agent-vs-agent driver exercises the synchronous turn engine only. The full
journey (compile → Phase-6 fan-out → report) also needs the QUEUE WORKER running (`python -m app.worker`) — per
backend/README, the API only enqueues; without the worker the compile/report never appear. #15 must run both processes.