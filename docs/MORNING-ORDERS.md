# Morning shift orders — July 6 (from Kaan, via watchtower)

You are the MORNING SHIFT lead. First read: CLAUDE.md, docs/SPRINT-STATE.md, docs/V2-PLAN.md, docs/MERGE_PLAN.md (A-sections). Kaan is awake. His verdict on the night: strong, not perfect yet. Emre is writing stage 3/6/7 docs right now; when they land, diff-don't-overwrite per protocol.

Priorities, in order:

1. **Dead nav sections.** Knowledge Base and Insights (and any other non-functional nav item) do not work in prod. Build them in a way that makes sense from the spec:
   - Knowledge Base = the record store, browsable: claims with trust badges, evidence quotes, filters by topic/tag/person/session. The Obsidian-style graph view only if cheap; a clean browsable list beats an expensive toy.
   - Insights = cross-interview intelligence: key findings, conflict points, perception gaps, admissions worth chasing.
   - The every-button-works rule applies to the nav itself: every item functional or removed.

2. **Premium pass round 2.** Kaan: "upgrades can be made to make this more premium." Motion and transitions, loading/empty states, typography rhythm, data density. Re-compare against the Ontora references in reference/. Small details compound.

3. **Real-life test simulation.** Kaan cannot test live today; GENERATE the realistic usage instead: run the full synthetic journey against PROD (not local), close the 2 open verification items from SPRINT-STATE (editor live-verify + perception-gap verdict).

4. **Fix the round-2 regression**: 1 trap triggered, terse fix was partial. Implement the computed coverage-routing V3 item if feasible; otherwise document precisely why not.

Standing rules bind: VC bar, cleanliness, named deviations, never park uncommitted, no em-dashes client-facing, ritual every 45-60 min. Spawn teammates as needed. Go.
