# Kaan's feedback queue

Watchtower appends Kaan's feedback here with a timestamp and priority. The build session
pulls from this queue at every BUILD-AUDIT-NEXT boundary (never mid-task). P1 items are
also pinged directly by the watchtower; everything else waits its turn here.

Format per item: `- [ ] YYYY-MM-DD HH:MM · P1/P2/P3 · the feedback, verbatim-ish · (source: chat/screenshot)`
Mark `[x]` with the commit hash when landed.

## Queue

- [x] (79b726f) 2026-07-07 19:10 · P2 · New Company modal renders anchored bottom-right instead of centered over the picker (screenshot evidence in chat) · fix: center the dialog, dim backdrop evenly
- [x] (79b726f) 2026-07-07 19:10 · P3 · Knowledge Base list scrolls endlessly with no end signal · fix: clear end-of-list state ("that's all N records") or honest pagination; user should always know where the bottom is
