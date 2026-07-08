# For Emre — a five-minute orientation

*Written July 7, 2026, the night after your two documents arrived. This is your map: what
exists, what was built from your thinking, what waits for you.*

## What Nexus is right now

A working product, live in production. An admin adds a company, uploads (or imports from
Fireflies, or generates) a CEO-call transcript, and the compiler turns it into a
trust-tagged record store and a Company Snapshot — pains, beliefs, people to interview.
From there: interview plans draft themselves from the records, pass an automated safety
check, wait for a human approval, and go out as voice or text interviews run by the
interviewer persona. Transcripts compile back into the same store; contradictions become
perception-gap findings. Tags never upgrade; truth emerges from comparing records.

## What was built from YOUR documents — the same day they arrived

Your stage-7 draft and stage-3 v0.4 were merged with a rule Kaan set: your docs enrich,
they never overwrite what's tested. Every idea was classified and logged
(docs/emre-inbox/MERGE-PACKET.md is the full accounting — it reads quickly and it's
honest about the three places we adapted your wording rather than adopting it verbatim).
The short version of what's now LIVE because of you:

- **Your fixed responses** are the interviewer's law at high-stakes moments — replace-me,
  off-record, anonymity, why-me, am-I-talking-to-an-AI, the pleaser, the stop request —
  identical across any future persona, each with an eval that tests it. Your anonymity
  wording became the PRIMARY promise product-wide (Kaan's call): "nothing gets quoted
  back with your name on it," with naming only if the respondent asks.
- **Your two-strike rule and scope lock** govern the navigator: a second deflection kills
  a topic for the session (the dodge itself is data), and discovered gold gets parked for
  its own conversation, never mined in the same sitting.
- **Your Tier-2 protocol** is enforced at the data layer: allegations never become
  records; a sealed flag goes to a table no client-facing surface can read, for YOUR
  review. The compiler is explicitly forbidden from compiling them.
- **Your six respondent types** were folded into the interviewer's read taxonomy
  (rambler, monosyllabic, suspicious, performer, venter, pleaser — merged with the reads
  we already had, one taxonomy, not two).
- **Your Question Yield Score** runs after every interview: which questions produced
  records, which produced air — computed deterministically from the verbatim quotes.
- **Your opener question** IS the opener now: "So, to start: what do you actually do
  here? How would you describe your job to someone new?" (Kaan banned the day-to-day
  form everywhere after hearing both.)
- **Your stage-3 v0.4 hooks**: the people-map branch has its own session kind, and the
  artifact-ask authorization travels from the CEO call into the interviewer's package —
  it never invokes the sponsor's blessing unless it was actually captured.

## Waiting on you (in order of weight)

1. **Tier-3 (imminent harm).** Deliberately a stub: the interviewer stops, responds as a
   caring human, routes to people — and improvises nothing beyond that. The stop script
   and routing contacts are yours to author personally, then Kaan confirms, before any
   live interview. Nothing we could write substitutes for this.
2. **The anonymity script wording** — Kaan decided the mechanism (flat promise,
   respondent-initiated crediting); the final phrasing is yours to bless or refine.
3. **A flaky eval needs your ruling**: our judge sometimes fails the venter-bridge move
   ("walk me through the last time that happened") that your own §8 prescribes. Either
   the bridge is capture (we loosen the eval) or the move needs reshaping. We didn't
   touch it — relaxing an anti-sycophancy test to pass our own build felt wrong.
4. **The opener's descriptive "day to day"** in the intro sentence — Kaan is deciding
   whether the ban covers descriptive use; your view welcome.
5. **The persona family** (varying delivery over the fixed baseline) — parked for a you
   + Kaan session, exactly as your draft marked it.

## How to explore without breaking anything

Open a terminal in the repo and start Claude — then just ask, in plain language:
"show me what the interviewer is told about sealed flags," "what does the compiler do
with an allegation," "walk me through what happens after a respondent says 'off the
record'." Claude reads the files and answers with sources; you don't need to touch
anything, and reading can't break anything. (If you're asked to approve a change, that's
your cue that something WOULD change — decline unless you mean it.)

## Where things live

- `prompts/agents/stage7-interviewer.md` — the interviewer persona. Your sections are
  marked with comments citing your draft.
- `prompts/agents/stage4-compiler.md` — extraction rules, incl. the disclosure boundary.
- `docs/emre-inbox/MERGE-PACKET.md` — every decision made about your two documents, with
  reasoning. If you disagree with any classification, that's a conversation we want.
- `evals/interviewer/` — the behavioral test suites (your fixed responses have their own
  file). `docs/MERGE_PLAN.md` — the numbered decision log (A1–A27 so far).
- The live product: https://nexus-v2-alpha.vercel.app — your personal login was relayed
  in chat; your voice-interview invite link is active whenever you want to meet the
  interviewer yourself.

The methodology is yours; the plumbing is ours. Where the two met tonight, your thinking
usually won — and where it didn't, the reasoning is written down for you to challenge.
