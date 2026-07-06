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

**Status update (July 6, terse fix 31f6f13):** the coverage-routing gap is now ADDRESSED. The class-level terse fix
("brevity never satisfies a completion condition; a terse answer owes an exceptions probe + a last-actual-episode anchor
before a must-hit closes"; timelines/targets get the felt-vs-measured probe) landed in stage7-interviewer.md. Verified on
the direct adapter: the two motivating bookkeeper traps (terse-close, target-as-timeline) flip fail→pass, 27/27 tuning
set, no regression (arc: `evals/adjudication/persona-fix-log.md`). Still pending: an **http re-run of the full 5-persona
matrix** to confirm h-bk-3 now surfaces on the real multi-turn engine (needs backend EVAL_MODE). Applied-pending-review
with Emre (morning-packet Q3). Foreman run (`runs/foreman-1783326554`) mined clean — 3/3 hidden, 0/3 traps, no new case.

## Note for the FULL E2E (#15)
The agent-vs-agent driver exercises the synchronous turn engine only. The full
journey (compile → Phase-6 fan-out → report) also needs the QUEUE WORKER running (`python -m app.worker`) — per
backend/README, the API only enqueues; without the worker the compile/report never appear. #15 must run both processes.