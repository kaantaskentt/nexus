<!-- Sources: docs/MERGE_PLAN.md A9 (Glossary & policies: frozen term list; candidate split into opportunity/gap/suggestion) + A1 (hypothesis→heuristic rename) + A10 (product identity) + Phase 7 glossary freeze + EK 4.1 (candidate conflation split) + F2 (cross-client boundary) + F4 (employee data) + F21 (conflict resolution — Emre) + A12 (bias firewall). The single source of truth for terms + policy language every prompt and every client-facing surface aligns to. -->

# Glossary & policies (frozen)

This is the shared vocabulary and the hard policies. Every agent prompt, every UI string, and every human-experience copy file uses these terms exactly and honors these policies. When a term here and a term elsewhere disagree, **this file wins** for naming; `docs/MERGE_PLAN.md` still wins for behavior.

## Frozen terms — use these, retire the rest

| Use this | Not this | Meaning |
|---|---|---|
| **interview** | conversation-with-employee, survey (client-facing) | The structured elicitation with one respondent. "Interview" everywhere client-facing. |
| **heuristic** | hypothesis (for Stage 2 pre-call priors) | A falsifiable prior we expect to be wrong sometimes (A1). The word "hypothesis" is reserved for the CEO's own beliefs, tested post-call. |
| **claim record / record** | finding | One structured thing one person expressed. The atom of the system. |
| **trust tag** | confidence score | The ladder position: SCRAPED < GUESS < CLAIMED < CONFIRMED < VERIFIED. Never a number. |
| **Company Snapshot** | dashboard, report (that's Stage 8) | The living client-facing picture rendered from records. |
| **perception gap** | discrepancy, error | Divergence between leadership belief and floor reality. Report-only (F27). |
| **respondent / interviewee** | subject, user, candidate | The person being interviewed. |
| **pain band** | pain score, severity number | Coarse LLM-judged band: low / moderate / high / severe. Never a decimal. |

### The "candidate" split (EK 4.1 — the killed conflation, A7)
The old system fused three different things into "candidate." They are now three distinct terms; never reintroduce "candidate":
- **opportunity** — a workflow or pain worth acting on (surfaced from records).
- **knowledge gap** — something we don't yet understand and should interview toward (an admission / a GUESS / an unsatisfied objective).
- **website suggestion** — a public-web observation (SCRAPED). Reference only; never a finding, never a recommendation.

### Product identity line (A1/A10 — top of README, feeds every stage prompt)
> **Nexus is a world-class interviewer and context extractor. It finds context, not solutions.**

Outputs are: the trust-tagged record store · the living Company Snapshot · conflict + perception-gap findings · verified workflow maps · SOP documents. **Executable skill generation is not a v1 output** (A10). ("Nexus" is a config placeholder — brand-as-config, A13.2.)

## Policies — enforced in code and prompts, not by discretion

### Cross-client boundary (F2 — live, A12)
Records, names, and workflows **never cross between client tenants.** The only thing that compounds across clients is per-industry heuristic accuracy — never a fact about one client reaching another. Three real tenants make this day-one enforcement. Demo fixtures carry a hard `is_demo` flag and never enter a real tenant.

### Employee data (F4)
For scraped/registry people: **names and roles only.** No scraped personal data beyond what's needed to match a call-mentioned name to a role. Vendor-side people can never become client entities (EK 2.1).

### Sentiment quarantine (Non-negotiable 4)
Opinions about a named person's competence, character, or worth are split into their own record, flagged, and **locked at the data layer** — never rendered where the client's employees could see them, never feeding pain scores or process data. Deny-by-default, not filter-per-screen.

### Attribution (A3 / EK 3.2)
No verbatim attributed quotes from employee interviews on any client-visible surface — paraphrase, and default to **role-level attribution** ("someone in packing"). CEO-call quotes with timestamps stay in the CEO's own view. Person characterizations require the respondent's explicit release.

### Nothing reaches employees without the gate (Non-negotiables 2 & 3)
Objectives shape questions, never statements. Nothing the CEO said ever reaches an interviewee. Nothing is sent to any employee without explicit human approval.

### Conflict resolution (F21 — Emre owns the final policy)
Contradictions are linked as DISPUTED; both records survive; nothing is resolved automatically. Provisional precedence until Emre's policy lands: episodic beats habitual, firsthand beats secondhand. Replace on arrival — diff, don't silently overwrite.

## Maintenance
This file is frozen for the pilot (Phase 7 glossary freeze). Changing a term here is a cross-cutting decision — update it here first, then propagate to prompts + UI + copy in the same change. Emre's deliverables (pain rubric, hedge audit, F21 policy, persona) supersede the marked v1 placeholders on arrival.
