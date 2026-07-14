# PRD — Deep Research Knowledge Base (post-snapshot operational context)

<!-- Sources: docs/MERGE_PLAN.md A14 (domain-neutral prompts, runtime-injected industry
     calibration) + the industry_prime mechanism (prompts/agents/role-schema.md,
     backend/app/pipeline/handoff.py::_industry_prime, WS-1b) + the cross-client boundary
     ("what compounds across clients is per-industry heuristic accuracy only — never
     records, names, or workflows", MERGE_PLAN.md:204) + A12 is_demo firewall + the claims-
     grounded chat retrieval pattern (backend/app/routers/chat.py::_retrieve). This document
     proposes new product surface; it does not override any non-negotiable in CLAUDE.md. -->

## 1. The gap this closes

Nexus already knows a lot about a client's business by the time the Company Snapshot
first renders: what they sell, roughly how big they are, their public footprint
(Stage 1 recon), and whatever the CEO said on the discovery call (Stage 3). What it does
**not** have is what a 20-year sales veteran, or a BCG case-team alum, would already know
walking into that industry cold: how businesses shaped like this one *usually* run —
the standard process stages, the tools that show up, the org shape, the KPIs people in
this seat actually get measured on, the failure modes everyone in the vertical fights,
and what "done" normally means for its core workflows.

That gap shows up downstream as exactly the failure Emre and Kaan already diagnosed once
(`docs/NIGHT-ORDERS-JUL10.md` §2, WS-1): the interviewer and the plan-generator can ask
competent *questions*, but without a grounded map of the territory they either ask
definitional ("what is data cleaning?") or generic ones, and the plan's Definition of Done
is a guess rather than an informed bar. The existing fix (`industry_prime`,
`role-schema.md`) is real and it works, but it is deliberately tiny (≤180 words, pure model
knowledge, `{role, industry}` only, regenerated per plan) — a sharpener, not a knowledge
base. It was never meant to hold researched, citable, reusable operational depth.

This PRD adds that depth as its own layer: a **Deep Research Knowledge Base (DR-KB)**,
built once per "kind of business," grounded by actual research (not just model priors),
organized into **Research Cases** that can be scoped to one workspace and, when thin,
fall back to other workspaces' matching cases — the same "per-industry heuristic accuracy
compounds, records never do" boundary the spec already draws for prompt examples
(MERGE_PLAN.md:204), now applied to something richer and dynamically generated instead of
four hand-written files in `prompts/examples/`.

## 2. Goals / non-goals

**Goals**
- Generate a real research pass — grounded in web sources, not just model recall — after
  the first Company Snapshot render, using what the snapshot already established
  (industry, services, scale, business model) as the research brief.
- Store it as a **separate knowledge layer**, never as `claim_records`. It carries no
  trust tag, is never evidence about *this* company, never renders in the client-visible
  snapshot, and is never cited in a report.
- Organize research into **cases** (industry × business-model × scale shape), not
  1:1 per workspace, so two workspaces that are "the same kind of business" reuse and
  compound the same research instead of re-researching it from scratch.
- Retrieval that is **workspace-scoped first, cross-case fallback second**: pull this
  workspace's own case content; if a query is thin there, widen to other matching cases —
  respecting the `is_demo` firewall (A12) and the cross-client boundary (case content must
  stay about the *vertical*, never about a specific company, to be reuse-eligible).
- Make the plan-generator's Definition of Done and the interviewer's industry priming
  measurably sharper by grounding them in this KB instead of (or in addition to) pure
  model knowledge.

**Non-goals (v1)**
- Not a client-visible feature. Internal calibration layer only, same visibility class as
  `industry_prime` — admins may see/review it, respondents and clients never do.
- Not a source of company facts. It never asserts anything about the specific client and
  is never allowed to leak into an objective, a question, or a snapshot card as if it were
  a finding about them (same discipline as `role-schema.md` hard rule 1).
- Not replacing the trust ladder. SCRAPED/GUESS/CLAIMED/CONFIRMED/VERIFIED describe
  evidence about a real company; DR-KB content is reference knowledge about a category of
  company and sits outside that ladder entirely, not at the bottom of it.
- Not real-time. It runs once per case (regenerated on a staleness policy, §8), not per
  interview.

## 3. Core concepts

### Research Case
The reusable unit. A case is a "kind of business" bucket, keyed by a fingerprint of
`{industry, business_model, scale_band}` (e.g. *jewelry / D2C + wholesale / boutique
<50 staff*). One case can serve many workspaces. A workspace is linked to exactly one
"own" case (created from its snapshot) and may additionally draw on any number of
"fallback" cases the retrieval layer finds relevant.

### Research Finding
The retrievable content unit inside a case — one researched paragraph per row, tagged by
section (`process_areas`, `tools_systems`, `roles_org`, `kpis_benchmarks`,
`failure_modes`, `vocabulary`, `definition_of_done`, `seasonality`, `compliance`), each
with a source citation where the research agent found it, and an embedding for semantic
retrieval — same shape as `client_visible_claims.embedding`, same `embed()` /
`to_pgvector()` helpers (`backend/app/embeddings.py`), just a different table.

### Why "case" and not "per workspace"
A single accounting firm's operational territory is the same territory every other small
accounting firm lives in. Researching it fresh per client is waste, and it's exactly the
"stuffing business-process examples... overfits to whichever industries we happened to
write down" problem A14 already named — except now the fix is dynamic research instead of
four static files, so it needs a matching/reuse key instead of a filename.

## 4. How this plugs into what already exists

Three integration points already do a version of this narrowly; DR-KB generalizes and
deepens each rather than inventing a parallel system:

| Existing mechanism | What it does today | What DR-KB adds |
|---|---|---|
| `prompts/examples/<industry>.md`, loaded by `compiler.py::_load_industry_block` | 4 hand-authored files, exact-string industry match, teaches *tagging judgment style* only (A14) | A generated, per-case researched block, matched by fingerprint/similarity instead of exact string, with real operational depth |
| `_industry_prime` (`handoff.py`) + `role-schema.md` | Tiny (~1400 char) prime, generated live per plan from `{role, industry}`, pure model knowledge, no citations, no reuse across plans in different workspaces | `role_schema` keeps generating the prime, but can now retrieve top-k DR-KB findings for `{role, industry}` first and synthesize *from grounded research* instead of recall alone — same 1400-char budget, better-sourced content |
| `chat.py::_retrieve` | Embedding search over `client_visible_claims`, workspace-scoped, feeds `run_agent(..., retrieval_queries=..., claims_grounding=True)` | The exact same retrieval shape, pointed at `research_findings` instead, with the added own→fallback scoping this PRD introduces |

Nothing here removes the existing mechanisms; DR-KB is additive and fails open exactly
like they do (`embeddings.py`'s doc-comment: "a missing/failing embedding API must never
block a compile" — DR-KB inherits that discipline, see §9).

## 5. Trigger and generation

**When it fires.** Enqueued once per workspace, the same way `render_snapshot` decides
it's looking at the founder/discovery call (`compiler.py::_should_render_snapshot`: a
render with `plan_id is None`). Concretely: after `render_snapshot` completes its first
successful render for a workspace, enqueue a `deep_research` job with `{workspace_id}`.
Best-effort, async, non-blocking — the snapshot and everything else works with or without
it, same as embeddings.

**The brief.** The job reads `workspaces.industry` plus the just-rendered snapshot's
`learned` cards (company-fact confidence cards only — never `area_to_investigate` pain
cards, never anything with a named person, never a quarantined source) to build a short
research brief: what they sell, scale signals, business model shape. This is the *only*
company-specific information the research agent ever sees, and only to scope the query —
it must never appear verbatim in the output (mirrors `role-schema.md`'s discipline:
"you are given only a role and an industry... write the profession, never the company").

**The agent.** New prompt `prompts/agents/deep-research-analyst.md`, domain-neutral core,
STRONG model seat (non-negotiable 7 — this is a demanding, expensive-by-design seat).
Unlike `role_schema`, it receives `{industry, business_model, scale_band}` directly as
input rather than via the `{{INDUSTRY_CALIBRATION}}` marker (same shape as `role-schema.md`
— it has no per-engagement calibration block to inject; the industry/shape *is* its whole
input). It is expected to actually research: it needs a web-search-capable tool call, not
pure recall, because "grounded, not just model priors" is the entire point of calling it
*deep* research rather than another industry_prime.

**Tool: Anthropic's server-side web search + web fetch (confirmed).** `web_search_20260209`
(name `web_search`) as the primary tool, `web_fetch_20260209` (name `web_fetch`) for pulling
full content of a specific page the search surfaced — both server-side (no client-side fetch
loop to write), no beta header, and the `_20260209` variants carry built-in dynamic filtering
(cheaper, more accurate than the older `_20250305` basic variant). Firecrawl
(`firecrawl_api_key`, already provisioned) stays reserved for Stage 1 recon's known-URL
crawl; it's the wrong shape for open-ended multi-query research across a vertical. Cap
`max_uses` on both tools per run — this is a per-case cost, not a per-interview one, but
still bounded, not unlimited. Model seat: `claude-sonnet-4-6`, matching the existing
strong-seat convention used by every other demanding agent in this codebase (interviewer,
compiler, plan_generator) — not Opus; a right-sizing call, not a corner-cut, and a one-line
bump if a research pass ever needs more than Sonnet gives it. Output: one `research_finding`
row per section, each citing the source URL it came from (§5b makes citation mandatory, not
best-effort).

**Case resolution.** Before generating, look up an existing case by fingerprint match
(exact first, then embedding similarity on a case summary above a threshold). If found and
not stale, link the workspace to it as `fallback`-eligible immediately — no regeneration.
If not found, generate a new case, `status = 'draft'`, `origin_workspace_id` set, linked
`relation = 'own'`.

## 5b. Definition of Done — when is a research pass actually done

The interviewer and plan-generator each have an explicit completion condition (§Plan
structure in `plan-generator.md`: "a specific episode + steps + tools + exceptions").
Deep research needs the same discipline — a case is not "researched" because the agent
produced *some* text, exactly the same anti-fluency principle the interviewer applies to a
respondent's polished non-answer. This is enforced in code, not just prompted for, in
`deep_research.py::_evaluate_dod`, and the result is stored on the case as
`dod_met: boolean` — never silently assumed true.

**Sections, and which are must-hit vs nice-to-have:**

| Section | Tier | Min findings |
|---|---|---|
| `process_areas` | must-hit | 2 |
| `tools_systems` | must-hit | 2 |
| `roles_org` | must-hit | 1 |
| `failure_modes` | must-hit | 2 |
| `definition_of_done` | must-hit | 1 |
| `kpis_benchmarks` | nice-to-have | 0 |
| `vocabulary` | nice-to-have | 0 |
| `seasonality` | nice-to-have | 0 |
| `compliance` | nice-to-have | 0 |

**A case is `dod_met = true` only when ALL of the following hold:**
1. Every must-hit section has at least its minimum finding count.
2. Every stored finding has a non-null, non-empty `source_url` (§5c — no exceptions, not
   even for a finding the agent considers "obvious"; if it can't cite it, it doesn't ship).
3. No finding body is trivially short or generic (`len(body) < 40` chars is an automatic
   reject — this is a coarse guard against filler, not a quality judge; see §5c for the
   real selectivity discipline, which is the agent's job, not a length heuristic's).
4. At least one `web_search` or `web_fetch` tool call actually ran (a case built from zero
   tool calls is a `role_schema`-style recall dump wearing a DR-KB case's clothes, and must
   never be silently accepted as one — this is exactly the distinction §2's non-goals
   section draws between grounded research and pure model priors).

**When DoD isn't met:** the case still saves (fail-open, same posture as everything else in
this system) with `dod_met = false` and `status = 'draft'`. A `draft` case is usable by its
own origin workspace (§9's "own case is usable immediately") but is **never** fallback-
eligible regardless of `status` — the fallback-eligibility gate in §9 is `status = 'approved'
AND dod_met = true`, both required. This closes a gap the original §9 language left open:
an admin could otherwise approve a case that never met its own completion bar.

**Rerun policy:** a `dod_met = false` case is a candidate for automatic retry once (bump a
`generation_attempts` counter, cap at 2) before it's left for a human to look at from the
admin research tab — a research pass that came back thin is far more likely a query-scoping
problem worth one retry than a permanent fact about the vertical.

## 5c. Chunking discipline — signal only, and every claim carries its source

Deep research must not become a second, uncontrolled record store. Two rules, both
enforced structurally, not just requested in the prompt:

**Selectivity — chunk findings, not paragraphs.** The agent is instructed (and the JSON
output contract enforces the shape) to emit one dense, decision-relevant claim per
finding — the same "one clean sentence" discipline `stage4-compiler.md` already applies to
transcript claims — never a summarizing paragraph, never a restatement of something any
educated adult already knows about the industry. A finding earns its place only if it would
change a question the plan-generator asks, sharpen a definition-of-done, or correct an
interviewer's assumption about the territory. Per-section finding counts are capped (6 for
must-hit sections, 4 for nice-to-have) — a hard ceiling on the schema, not a suggestion — so
the agent is forced to select its best evidence rather than dump everything it found.
Obvious, generic, or already-common-knowledge statements ("small businesses care about
cash flow") are explicitly banned in the prompt's hard rules, mirroring `role-schema.md`'s
"table stakes are assumed" discipline extended from a 180-word prime to a whole case.

**Source attachment — mandatory, not best-effort.** Every `research_findings` row requires
a `source_url` populated from the actual `web_search_tool_result` / `web_fetch_tool_result`
block the agent drew the claim from — never a guessed or remembered URL (the same "never a
number you recall from training" discipline the disclosure protocol applies to crisis
hotlines applies here to citations: an invented source is worse than no source, because it
looks verified when it isn't). Enforcement is two-layered:
1. **Schema-level:** the output contract's `source_url` field is required, not optional,
   for every finding — a finding without one fails JSON validation, not a soft warning.
2. **Code-level backstop:** `deep_research.py` drops (never silently keeps) any finding
   whose `source_url` isn't a URL actually present in that run's search/fetch tool results
   — the agent cannot satisfy the requirement by inventing a plausible-looking URL, because
   the code cross-checks against the tool call log, not just against "is this a string."
A dropped finding still counts against nothing — it simply never reaches the DB, and if
dropping it pushes a must-hit section below its minimum, DoD evaluation (§5b) reflects that
honestly rather than papering over it.

## 6. Data model (proposed — migration `0031_research_kb.sql`)

```sql
create table research_cases (
  id                   uuid primary key default gen_random_uuid(),
  industry             text not null,
  business_model        text,               -- e.g. "D2C + wholesale"
  scale_band           text,                -- e.g. "boutique <50 staff"
  fingerprint          text not null unique,-- normalized industry|model|scale key
  title                text not null,       -- human label for the admin UI
  summary_embedding    vector(1536),        -- for similarity match when fingerprints miss
  status               text not null default 'draft'
                       check (status in ('draft', 'approved', 'stale')),
  dod_met              boolean not null default false,   -- §5b — never assumed true
  generation_attempts  int not null default 1,            -- §5b rerun-once policy, capped 2
  origin_workspace_id  uuid references workspaces(id),
  is_demo              boolean not null default false,   -- A12 firewall, fixed at creation
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table research_findings (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references research_cases(id) on delete cascade,
  section      text not null check (section in
               ('process_areas','tools_systems','roles_org','kpis_benchmarks',
                'failure_modes','vocabulary','definition_of_done','seasonality',
                'compliance')),
  title        text,
  body         text not null,
  source_url   text,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);
create index research_findings_case_idx on research_findings (case_id);

create table workspace_research_links (
  workspace_id uuid not null references workspaces(id),
  case_id      uuid not null references research_cases(id),
  relation     text not null default 'own' check (relation in ('own', 'fallback')),
  linked_at    timestamptz not null default now(),
  primary key (workspace_id, case_id)
);
```

Job audit reuses the vendored `agent_runs` chassis table (per CLAUDE.md build
conventions — vendor chassis pieces, don't reinvent). No new trust-tag column anywhere:
that is the structural guarantee that this content can never be mistaken for a claim.

## 7. Retrieval — own-first, fallback-second

New helper, same shape as `chat.py::_retrieve`:

```python
async def retrieve_research(workspace_id: str, query: str, k: int = 8) -> list[dict]:
    qvec = to_pgvector(await embed(query))
    own_case_ids = await _case_ids_for(workspace_id, relation="own")
    rows = await _search(case_ids=own_case_ids, qvec=qvec, k=k)   # own case(s) first
    if len(rows) >= k or qvec is None:
        return rows
    fallback_ids = await _matching_case_ids(workspace_id, exclude=own_case_ids)
    rows += await _search(case_ids=fallback_ids, qvec=qvec, k=k - len(rows))
    return rows
```

- **Own scope**: this workspace's linked case(s), always searched first — this is the
  "filter a specific deep research context per workspace" requirement.
- **Fallback scope**: other `approved` cases matching on `industry` (and `business_model`
  similarity via `summary_embedding`), searched only when own-scope results are thin —
  this is the "use the other deep researches when we don't have all the information"
  requirement. `draft` cases are never fallback-eligible (§9) — an unreviewed case could
  be wrong, and a wrong case now contaminates every workspace that borrows it, not just its
  origin, which is a materially bigger blast radius than a bad `industry_prime`.
- **is_demo firewall (A12), both directions**: a demo workspace's case pool and a real
  tenant's case pool never cross in either scope. Enforced the same way `is_demo` is
  enforced everywhere else — a hard `where` clause, not a convention.
- **Cross-client boundary**: fallback only ever returns section content, which by
  construction (the agent's brief, §5) never contains company names, people, or specific
  claims — only the vertical's general shape. This is the same guarantee `role-schema.md`
  gives today, just at case-KB scale instead of per-plan scale.

## 8. Consumers

1. **Plan generator's industry calibration** (`plan-generator.md` `{{INDUSTRY_CALIBRATION}}`,
   assembled today by `compiler.py::_load_industry_block`): extend assembly to append
   `retrieve_research(workspace_id, f"{role} {topic-in-progress}")` results, especially for
   the **Definition of Done** section — this is the concrete answer to "know the definition
   of done," since DoD templates are one of the researched sections.
2. **Interviewer's industry prime** (`handoff.py::_industry_prime` /
   `role-schema.md`): `role_schema` retrieves top-k findings for `{role, industry}` before
   writing, and synthesizes the ≤1400-char prime from grounded content instead of recall
   alone. The prime's size budget and its "territory never company" rule (WS-1b) are
   unchanged — only its inputs get better.
3. **Stage 1 recon / Stage 3 context call** (optional, phase 3): sharper calibration for
   what to look for and what vocabulary to expect, same injection point.
4. **Admin research surface** (new): a read-only-by-default tab per workspace showing its
   linked case(s) and findings, with edit/approve controls — mirrors the existing
   admin-only surfaces (`company_report.py`, `workspaces.py` router conventions). New
   router `backend/app/routers/research.py`:
   `GET /workspaces/{id}/research-cases`, `POST .../approve`, `PATCH` a finding,
   `POST /workspaces/{id}/research/regenerate`.

## 9. Review gate (recommendation, flag to Kaan)

Because a `fallback`-eligible case is now shared infrastructure across clients — a
hallucinated finding doesn't just weaken one workspace's plan, it weakens every workspace
that borrows the case — recommend gating fallback-eligibility behind **both**
`status = 'approved'` (an admin's call, set from the research tab) **and** `dod_met = true`
(§5b's code-enforced completion bar — a case can't be approved into looking more finished
than it is). A workspace's **own** case is usable immediately regardless of either flag
(draft-and-thin is fine for the workspace that generated it, same fail-open posture as
everything else); it only needs both gates before other workspaces can lean on it. The
`dod_met` half of this gate isn't a judgment call — it's mechanical, covered in §5b. The
`status = 'approved'` half is: this is the one piece of this PRD I'd bring to a Kaan
check-in rather than just ship — my recommendation is above, veto welcome.

## 10. Compliance mapping (non-negotiables, CLAUDE.md)

1. **Tags never upgrade** — N/A by construction: research findings carry no trust tag and
   never enter `claim_records`.
2. **Objectives shape questions, never statements** — DR-KB content only calibrates
   phrasing (industry block, prime), exactly like today's mechanisms; it never becomes an
   objective or a statement to an interviewee.
3. **Human gate** — DR-KB never talks to an employee or respondent; it only shapes what an
   already-approved plan or already-running interviewer says.
4. **Sentiment quarantine** — the research brief (§5) draws only from non-quarantined
   `learned`/company-fact cards; it structurally cannot see quarantined sentiment.
5. **Scraped ≈ 20%, transcript is the product** — DR-KB sits *outside* this ratio
   entirely; it is not evidence about the company at any weight, and must never be
   presented as if it were.
6. **`is_demo` firewall (A12)** — enforced in both retrieval directions, §7.
7. **Strong model in demanding seats** — the deep-research agent is a STRONG-seat agent
   config, never a mini model.
8. **Prompts stay domain-neutral** — `deep-research-analyst.md` and `role-schema.md`
   updates keep the core prompt domain-neutral; industry is a runtime query/parameter,
   never hardcoded into the prompt text.

## 11. Rollout (expensive → work → cheap, per CLAUDE.md build conventions)

- **Phase 1 — make it work.** Manual trigger only (admin button), one case per workspace
  (no reuse/fingerprint matching yet), stored and admin-visible, NOT yet wired into the
  plan-generator or interviewer. Verify research quality on 2-3 real workspaces before
  anything downstream depends on it.
- **Phase 2 — wire it in.** Auto-trigger after first snapshot render (§5); wire into
  plan-generator's industry calibration and `role_schema`'s prime generation (§8).
- **Phase 3 — make it cheap, add reuse.** Fingerprint/similarity case matching and the
  own→fallback retrieval split (§7) go live; approval gate (§9) becomes load-bearing once
  cross-workspace reuse is real; add case staleness policy (re-research a case after N
  months or M linked workspaces report it as thin).

## 12. Success metrics

- Plan-generator Definition of Done sections cite a researched DoD template, not a
  generic restatement, for workspaces with a linked case.
- Interviewer prime quality: fewer "what is X" style questions in transcripts for roles
  with a grounded prime vs. the current pure-recall prime (compare against the existing
  eval transcripts, `docs/MERGE_PLAN.md:169`).
- Case reuse rate: fraction of new workspaces that resolve to an *existing* approved case
  on first snapshot, rather than generating a new one (this is the direct measure of
  "per-industry heuristic accuracy compounds" actually compounding).

## 13. Open questions for the Kaan/Emre check-in

- Fallback default: on by default for non-demo workspaces (recommended — the whole value
  of "cases" is the network effect), or opt-in per workspace? Flag with recommendation.
- Should `research_findings` ever be allowed to surface a citation link in an admin-facing
  view (not client-facing), so an admin can sanity-check where a claim in the prime came
  from? Recommended yes, admin-only, same visibility class as everything else here.
