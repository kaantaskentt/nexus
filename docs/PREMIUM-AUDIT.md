# Premium SaaS audit — July 7 2026 evening (self-directed, Kaan's mandate)

Method: full prod walk (nexus-v2-alpha.vercel.app) with a real browser, three personas:
**new admin** (first company, clicks-to-value), **returning CEO** (test a voice, second
call, what changed), **Emre the psychologist** (every client-facing word for safety,
framing, trust, tone). Evidence: docs/audit-screens/audit-*.png. Ranked; fixes marked
FIXED land tonight (commits in WHAT-CHANGED-TONIGHT.md), PROPOSED stay unbuilt.

## P0 — broken journeys

**1. Plan approval is broken for every generated plan.** [FIXED]
Every plan generation lands in NEXUS_CHECK, but the Nexus-check reviewer seat (agent
config seeded since migration 0001, prompt exists) was NEVER wired to a job — nothing
moves a plan forward, and NEXUS_CHECK→APPROVED is not a legal transition, so the UI's
"Approve plan" button answers **API 409** (reproduced live on prod: audit-06, console
log). Two plans on bee-goddess sat in "Nexus is reviewing…" for 24+ hours — the copy is
a standing lie. The custom-interview flow Kaan tested today dead-ends here too.
Fix: wire the reviewer as a real job (generate → check → AWAITING_APPROVAL with findings
logged, RETURN → DRAFT with flags), show Approve only when it's legal, honest "checking
now" state, a redraft button for empty/returned drafts, and backfill the stuck plans.

**2. Consent page contradicts the interviewer's promise.** [FIXED]
audit-10: the respondent consent page still says "Before anything is attributed to you
by name, you'll see it…" while the interviewer (verdict 1, Emre-primary) now promises
"nothing gets quoted back with your name on it" with naming only if the respondent asks.
Two different promises about the same mechanism, seen minutes apart by the same person,
is a trust breach in Emre's exact lane. Fix: consent page aligned to the Emre-primary
mechanism (flat promise + respondent-initiated credit path).

## P1 — named-probe failures and misleading states

**3. "Quickly test a voice" is a dead end.** [FIXED — test call; clips PROPOSED]
audit-08: every voice card reads "Preview unavailable" (stock clips were rightly banned
this afternoon; no TTS keys exist to generate our own). A returning CEO cannot audition
anything without sending someone a real interview. Fix tonight: **"Hear it live"** —
one button on Voice Settings that mints a firewalled test session (new `voice_test`
kind: never compiles, never lists as an interview) and opens the respondent room so the
admin hears the actual assistant, actual opener, actual voice in one click. Preview
clips themselves stay PROPOSED until ELEVENLABS/DEEPGRAM keys land (script is ready).

**4. Scraped-only workspace shown as "an earlier upload".** [FIXED]
audit-02: Time PR has 18 records — all from the website scan, zero from any call — but
home says "Records from an earlier upload are saved…". A returning admin reads "my
upload got lost." Fix: scraped-only tenants get the true state: fresh start framing +
"the website scan saved N reference records; they'll enrich the snapshot."

**5. Interviews list is a junk drawer.** [FIXED — data; name fallback PROPOSED]
audit-04: six identical "Burak · voice · Not started" rows and two nameless
"Interviewee" rows — leftover July 6 casting/test sessions on the demo tenant (cleanup
was already authorized after the ryan verdict). A returning CEO can't tell which row
matters. Fix tonight: expire the stale test sessions on prod (audited SQL, reversible
status change, nothing deleted). PROPOSED: "Not started" rows could carry a
copy-invite-link affordance (already in the parked queue).

## P2 — premium polish

**6. Three dead "View transcript evidence" buttons on the flagship snapshot.** [FIXED]
audit-03: the Evidence rail's buttons are disabled with no explanation — the only dead
controls on the surface a client sees first. The record store IS browsable at Company
Context. Fix: link each evidence quote to Company Context instead of a disabled button.

**7. Empty Draft plan with no way forward.** [FIXED with P0-1]
audit-05: a "Selin — Draft" row with an empty goal (July 6 generation died during the
credit outage) just sits there. Fix: plan page detects a landed-empty draft and offers
"Draft again" (re-enqueues generation through the same gate).

## Probes with no defect found
- **Add a company end-to-end**: Time PR itself is today's fresh add; the picker hero
  guides into it and the empty state carries all three doors (paste / Fireflies /
  example). Clicks to first value: picker → Add company → upload → compile. Sound.
- **Non-CEO admin assumptions**: walked every surface's copy; "Who gave the call",
  "Founder or main contact", consent framing ("Bee Goddess asked Nexus") all hold for a
  non-CEO admin. No fix needed.
- **New-interview discoverability** (today's fix): audit-13 — ?new=1 lands with the
  form open. Works.
- **Second-call flow**: audit-03 bottom — "Add a call transcript" door under the
  snapshot. Works.

## PROPOSED (ambitious — not built tonight)
- Real preview clips per voice (script `generate_voice_previews.py` ready; needs
  ELEVENLABS_API_KEY / DEEPGRAM_API_KEY; regenerate on roster change).
- Nexus-check findings panel on the plan page (flags + proposed fixes rendered from the
  check's change_log entry, not just pass/return).
- Copy-invite-link + sent-state on interview rows.
- Interviews list grouping (active / needs attention / done) once real volume exists.
- "What changed since your last visit" digest for returning admins (needs visit
  tracking; pairs with the snapshot render_batch design).
