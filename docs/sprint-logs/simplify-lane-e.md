# SIMPLIFY lane E — the live room (task #7, E+F)

A28 pre-reviews (two lines each: today → after; simpler-or-more-complex for the user).
Each COMMIT is its own revertable commit, scoped `git commit -- <paths>`.

## COMMIT 1 — live_captures backend (NET-NEW, no existing surface changed)
Today: there is no live extraction; the only "live insights" are admin-typed observer
notes (codemap Area 5). Nothing shows a respondent what Nexus is capturing.
After: a per-turn structural extractor writes session-scoped `live_captures` (teams,
systems, workflows, decision rules, goals, open questions — STRUCTURAL only), read by a
public token-scoped endpoint and an admin variant. Sentiment about named people is
rejected at the data layer; every item needs a verbatim quote span or it is dropped as
invented; items never enter the KB (compile stays the only claim producer).
Simpler for the user: yes — net-new transparency surface, changes no existing flow. It
is additive; the turn path only gains a fire-and-forget enqueue gated to interview/context
kinds (eval/voice_test/roleplay never spawn extraction).
