# Demo runbook (live, on prod)

The one-page script for showing Nexus to a client. Everything below runs against the live
site. Read the "Rough edges" section once before you present so nothing surprises you.

- **Site:** https://nexus-v2-alpha.vercel.app
- **Login:** the admin account relayed to you separately (or your personal admin login). No
  signup on screen; admins are created by hand.
- **What is live:** admin login, the multi-company picker, "Add company", CEO-call upload
  with a live progressive compile, the Company Snapshot, Insights, the workflow editor,
  and the post-interview report. Interview links open without a login by design.

The demo has two acts. Act 1 is the "watch it build itself" moment on a brand-new company.
Act 2 shows the depth on the prepared Bee Goddess workspace, which already holds several
compiled interviews.

## Act 1: build a company from one call (about 3 to 4 minutes)

1. **Sign in.** Open the site, enter the login above. You land on the workspace picker.
2. **Add company.** Click "Add company". Type a name (for example, "Aurora Atelier"),
   an industry ("jewelry"), and optionally a website and a contact name. Create it. This
   is a real, private, empty workspace. Nothing from any other client exists inside it.
3. **Upload the CEO call.** You land on a guided empty state. Paste the transcript from the
   bottom of this page (or your own). Put the founder's name in "Who gave the call". Click
   "Build the snapshot".
4. **Watch it compile.** This is the moment. Nexus reads the call and works through real
   stages: reading the transcript and pulling records, mapping the workflow, rating where
   the pain is, looking for contradictions, then composing the snapshot. The counters
   ("records captured", "snapshot cards") tick up from real data, not a fake bar.
   **Honest timing: expect 60 to 90 seconds** of visible work. That is the real model doing
   the extraction. If a client asks, that is the point: it is reading the call the way a
   world-class interviewer would, not pattern-matching.
5. **The snapshot appears.** Cards animate in: what Nexus learned, the areas to investigate
   with pain bands, and who to interview next. Open an "area to investigate" card to show
   the drawer: the evidence quotes are the founder's own words, verbatim.

## Act 2: the depth (about 3 to 4 minutes)

6. **Switch workspaces.** Use the picker (the Nexus mark, top left, returns you there) and
   open **Bee Goddess**. It already has compiled interviews, so every surface is full.
7. **Snapshot.** Show the trust badges (Verified / High / Reported / Scraped) and that every
   claim traces to a quote. Point out that tags never upgrade: truth comes from comparing
   records, not editing them.
8. **Insights.** Open Insights from the left nav. This is the cross-interview intelligence:
   the key findings (banded pains), and the conflict points where the CEO's account and the
   floor's reality diverge. The real one to land on is the "yildirim" (rush order) gap.
9. **Workflow editor.** Open a workflow. Show that steps derived from claims are marked, and
   that manual edits are tracked and audited. It exports an SOP.
10. **Report.** Open a completed interview's report: the workflow canvas, the key findings,
    and the cross-interview conflicts (this is where perception gaps live, never on the
    live snapshot).

## Rough edges (know these so you are never caught out)

- **New company ends at the snapshot for now:** a company you build live in Act 1 stops at
  its Company Snapshot. The control to launch the next interview from a suggested person is
  still landing (the generate-plan API is live; the button is in flight). This is exactly
  why the demo pivots to Bee Goddess for Act 2, which already has interviews, plans, and a
  report. Frame the pivot as "now let me show you a workspace a few interviews in".
- **Em-dashes on the Bee Goddess tenant:** a few older records on this prepared workspace
  contain em-dashes in generated text; they clear at the next demo reseed. A company you
  create live in Act 1 is clean.
- **Report:** renders fully, the workflow, key findings, and cross-interview conflicts. An
  earlier gap in the quality leg was re-run on prod and closed (task #24).
- **First voice call:** voice is provisioned. If you want to show it, send a voice-modality
  interview from a plan; the respondent page shows "Start voice conversation".

## If something goes sideways

- **Compile seems stuck past ~2 minutes:** it is almost always the background worker, not
  the app. The app only queues the job; a separate worker runs it. Ping the team; do not
  re-upload (that just queues a second compile).
- **A screen looks stale after an edit:** reload once. Reads are no-cache now, so a reload
  always shows current data.
- **Fallback:** if Act 1 is slow on the day, skip straight to Act 2 on Bee Goddess, which is
  already fully compiled and needs no wait.

## Scripted CEO transcript (optional, paste in Act 1 step 3)

```
Deniz: Every morning our operations lead handles the repricing by hand. He keeps his own spreadsheet, has done for years.
Interviewer: How long does that take him?
Deniz: Two hours, maybe. Honestly the returns side is the real headache. Orders slip through, customers chase us, and it eats the whole team's morning. It is the thing that keeps me up at night.
Deniz: One thing, please do not mention anything to the Harrods people, we are renegotiating.
Deniz: Selin handles all the online returns. She would know that side far better than me.
```

This produces a snapshot with the repricing process, the returns pain (rated high), a
directive that is captured but never shown to employees, and two people to interview next.
