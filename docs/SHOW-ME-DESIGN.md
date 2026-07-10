<!-- Founding research doc for the "Show-me mode" feature (screen record / share).
     Source: Kaan + watchtower research session, July 9 2026. Status: DESIGN ONLY — no build
     until the consent design passes Kaan + Emre. -->

# Show-me mode — screen recording / sharing as an interview move

## The thesis
People can't describe their workflows accurately but they can show them. The screen is
where the shadow tool stack, the real step count, and the honest time-cost live — the
exact evidence the product hunts. "Share your screen and do it like a normal Tuesday."

## Use cases (ranked)
1. Shadow tools observed directly (Excel/WhatsApp) — upgrades evidence quality vs CLAIMED.
2. Perception-gap footage: CEO says 3 clicks, screen shows 9 steps + 2 exports + a WhatsApp ping.
3. Honest time measurement (feeds honest-ROI, never claim unknown numbers).
4. The artifact ask, captured live instead of chased for 24h.
5. Narrated recording ≈ 90% of an SOP draft (feeds Workflows/Skill Blueprint surface).

## Architecture (decided direction)
Three decoupled layers — swap any layer without touching the others:
- **Capture**: native browser getDisplayMedia + MediaRecorder (~200 LOC, no deps).
  The OS share-picker doubles as a consent surface (respondent chooses tab/window/screen).
  Reference impl if we ever want share links/team review: Cap (github.com/CapSoftware/cap, 18k★).
- **Semantic events** (later, our-surfaces-only): rrweb (MIT, 20k★) records DOM events not
  pixels — Scribe's secret. Only works where our code runs; can't see their ERP.
- **Understanding (our IP)**: worker job sends recording to a vision model with a
  Stage-4-style extraction prompt → timestamped observations → OUR compiler → claim
  records + tool inventory + SOP steps. Verbatim rule holds (audio via existing
  transcription path). Sentiment seen on-screen passes the same quarantine.

## Model economics (10-min walkthrough, ~90 frames or 600s video, ~4k out)
| Option | Cost | Notes |
|---|---|---|
| Gemini 2.5 Flash (video-native) | ~$0.07 | MVP pick. 300 tok/s of footage. ≈ one compile. |
| Gemini 3.1 Pro | ~$0.41 | smarter seat if Flash extraction disappoints |
| Claude Sonnet 5 (frames) | ~$0.56 (~$0.38 intro) | ~1,850 tok per 1568px frame; same family as compiler |
| Claude Opus 4.8 (frames) | ~$0.94 | |
| Twelve Labs (Marengo+Pegasus) | ~$0.73 | per-minute billing; the LIBRARY-SEARCH upgrade slot, not the start |
Anchors: interview $0.22, compile $0.07. A/B Gemini-vs-Claude extraction ≈ $5 of eval runs.

## Live "watch-me" phase (later)
- Fastest comprehension is NOT video: local event/text extraction (accessibility APIs /
  rrweb) in ms, streamed as text. screenpipe (github.com/mediar-ai/screenpipe, ~20k★) is
  the reference architecture for a desktop companion (accessibility-first, OCR fallback).
- For true pixels-live: **Gemini Live API** (WebSocket, sub-second) — same vendor as the
  recorded MVP, so live = transport upgrade, not re-architecture.
- **Transport layer (named slot): Vision-Agents** — github.com/GetStream/Vision-Agents
  (MIT). Agent joins a call as a participant; WebRTC-native, ~500ms join, <30ms media;
  pluggable backends: Gemini Live / OpenAI Realtime / Claude behind one interface.
  Solves the hardest engineering (media plumbing, drops, frame pipelines).
- **GPT-Live** (OpenAI, July 8 2026): full-duplex voice, no screen at launch. Watch item —
  evaluate as plug-in swap when API + screen support arrive (Kaan: yes, when API comes out).

## The watching brief (how the AI knows why it's watching)
Share never starts cold — always triggered by a claim in the interview. At share-start,
inject from live interview state:
- WHY: "[role] is demonstrating the claim: '[verbatim claim]'"
- EXTRACT: trigger, steps in order, every tool (esp. unofficial), handoffs, what
  finished looks like, claimed-vs-observed time.
- IGNORE: notifications, unrelated tabs, personal content (prompt to close; never record).
- BEHAVE: watch silently, ask at natural pauses (VAPI turn-taking discipline), request
  re-show of skipped load-bearing steps, never read private message content aloud.
- ALWAYS: work observations = records; people-sentiment (spoken OR seen) = quarantine;
  tag everything observed-in-demonstration.

## Competitive frame
OpenAI Record & Replay (Codex macOS app, June 18 2026): demo a workflow → natural-language
SKILL.md → semantic replay. Validates demonstration→artifact. NOT an API; can't embed.
Their aim: repeat YOUR workflow for you. Ours: reveal how the COMPANY works, trust-tagged
and cross-referenced. Same input, different product. (Kaan action: try it personally —
macOS + ChatGPT Plus; Turkey not excluded from launch regions.)

## Refusals (hard lines, from Kaan + watchtower session)
- Never record by default or silently; respondent holds start AND stop; visible indicator.
- Refuse surveillance framing entirely: footage feeds the COMPILER, never a browsable
  video library for admins; raw video never client-visible.
- Quarantine applies to on-screen people-content; extractor scoped to narrated task only.
- Recording pauses on password fields; personal content is respondent's to exclude.
- Build order: consent design (Kaan+Emre) BEFORE any code. Eval first on recorded
  walkthroughs (synthetic screen recordings with planted details, anti-theater grading)
  before any live work.
