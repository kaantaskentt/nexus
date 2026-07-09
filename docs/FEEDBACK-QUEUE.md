# Kaan's feedback queue

Watchtower appends Kaan's feedback here with a timestamp and priority. The build session
pulls from this queue at every BUILD-AUDIT-NEXT boundary (never mid-task). P1 items are
also pinged directly by the watchtower; everything else waits its turn here.

Format per item: `- [ ] YYYY-MM-DD HH:MM · P1/P2/P3 · the feedback, verbatim-ish · (source: chat/screenshot)`
Mark `[x]` with the commit hash when landed.

## Queue
- [x] (night block) 2026-07-08 20:45 · P2 · Simulations page shows identical global content in every workspace (new company "1% Session" shows the same cast/rounds as Bee Goddess) - reads as stuck/wrong in a workspace context. DESIGN RETHINK NEEDED, not just a fix: this is product-level trust content (how we test our interviewer), not company data. Options: (a) move it out of workspace nav to a product-level "How Nexus is tested" surface, (b) keep in nav but clearly framed as product-wide proving record with copy like "these tests apply to the interviewer that serves every company", (c) per-workspace sims someday. Also: the scores confuse CEOs/admins (14/16, 0/16 misleading cues) - reframe plain-language-first ("surfaced 14 of 16 hidden facts and took zero bait" as the headline, numbers secondary). Kaan wants a better think here, not a patch. · (source: screenshot)

- [x] (79b726f) 2026-07-07 19:10 · P2 · New Company modal renders anchored bottom-right instead of centered over the picker (screenshot evidence in chat) · fix: center the dialog, dim backdrop evenly
- [x] (79b726f) 2026-07-07 19:10 · P3 · Knowledge Base list scrolls endlessly with no end signal · fix: clear end-of-list state ("that's all N records") or honest pagination; user should always know where the bottom is
