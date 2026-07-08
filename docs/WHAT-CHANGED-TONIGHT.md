# What changed tonight — July 7, evening audit shift

One line of what, one line of why. Full evidence + ranking: docs/PREMIUM-AUDIT.md.

- **Walked the whole product on prod as three personas** (new admin, returning CEO,
  Emre) with a real browser; 13 screenshots in docs/audit-screens/.
  Why: you asked for eyes on every surface before any fix.

- **Fixed: approving a plan actually works now.** Every generated plan was parking in
  "Nexus is reviewing…" forever because the review step existed as a prompt but was
  never wired to run — and the Approve button answered an error (I reproduced the 409 on
  prod). The check now really runs after generation (leak scan, leading-question catch,
  credential guard), passes the plan to you for approval or returns it with logged
  flags, and the plan page shows the live state instead of a button that fails.
  Why: this was the single broken step in the product's core journey, including the
  custom interview you tested today.

- **Fixed: the two stuck Bee Goddess plans + the empty Selin draft.** The stuck ones get
  the new check run on them tonight; the empty draft (it died during yesterday's credit
  outage) now shows an honest "Draft the plan" button instead of sitting there mute.
  Why: no state should ever be a dead end with no explanation.

- **Fixed: consent page now makes the same promise the interviewer makes.** It said
  "before anything is attributed to you by name, you'll see it"; the interviewer (your
  verdict 1 today) says "nothing gets quoted back with your name on it" with crediting
  only if the respondent asks. Same promise everywhere now; the drift guard passes.
  Why: two different privacy promises minutes apart is a trust breach in Emre's exact lane.

- **New: "Hear it live" on Voice Settings.** One click opens a private test call with
  this workspace's actual interviewer — real voice, real opener. It's firewalled: a
  voice-test session never compiles, never gets screened, never appears in Interviews.
  Why: your probe "quickly test a voice" was a dead end — every preview card says
  "Preview unavailable" (stock clips were rightly banned this afternoon; real generated
  clips need ElevenLabs/Deepgram keys we don't have yet — script is ready for when we do).

- **Fixed: Time PR no longer claims you uploaded something.** Its 18 records are all
  from the website scan; the empty state said "records from an earlier upload are
  saved." Scraped-only workspaces now say the true thing: fresh start, plus "the website
  scan saved N reference records."
  Why: it read as "my upload got lost" — a false alarm on your own test tenant.

- **Cleaned: Bee Goddess interviews list.** Expired the 8 stale test/casting sessions
  (the six "Burak · Not started" clones and the consumed old Emre link — Emre's fresh
  invite untouched, nothing deleted), and the list now hides expired invitations behind
  an honest one-line count.
  Why: a returning CEO couldn't tell the real interview from the junk.

- **Fixed: the three dead "View transcript evidence" buttons on the snapshot.** They're
  now real links into Company Context, where those records actually live.
  Why: permanently disabled buttons on the first screen a client sees is the opposite
  of premium.

- **Also:** plan pages auto-refresh while a check or draft is running (no manual reload
  to see it unlock).
