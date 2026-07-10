# LANE ROOM-PARITY — July 10 — visual parity for the live room (Kaan's frustration item)

Owner: lane-sec (reassigned; I own components/interview/** and built the R1 split these sit on).
Scope: docs/ROOM-PARITY-ANYTIME-orders.md §ROOM-PARITY (display-only, A28 per surface, NO
behavior change). lane-quality builds ANYTIME-CONTEXT in parallel and reuses my room UNTOUCHED.

## HARD CONSTRAINTS (carry from R1 — do not regress)
- R1 holds exactly: ADMIN/observer shell gets the content cards; RESPONDENT shell stays
  counts-only (the count pill). Parity applies to BOTH shells' VISUALS, never their data.
- Sim marker stays; simulation room keeps counts-only + the practice-run marker.
- Display-layer only: no pipeline/persona/capture/by-token payload changes.

## REFERENCE GAP (flagged to team-lead)
The orders point to docs/kaan-inbox/room-mockups/ (the "4 screenshots") — that dir is EMPTY,
never committed. FEEDBACK.md's welcome mock is literally "(Place Alternative UI Here)" text,
and its media/image11 is the Plan page, not a room mockup. So there are NO pixel mockups in
the repo. The orders' TEXT is detailed (6 items) and team-lead pre-authorized the text-spec
fallback ("otherwise the mockups are the spec; flag ambiguous calls, don't guess"). Proceeding
on: orders text + the existing (taste-approved A19/SIMPLIFY-E) components + the Nexus token
system + current prod state. Pixel-exact calls flagged, not guessed. Asked team-lead for the
Figma file link (Kaan's file) in case the real mockups live there.

## CURRENT-STATE ASSESSMENT (what actually renders today)
- **Presence orb**: `ParticleOrb` (700-pt particle sphere, real-signal, taste-approved A19)
  EXISTS and renders in VoiceCall. BUT the context-call WELCOME (`ConsentLanding`) has NO orb
  at all. Gap: welcome hero orb missing.
- **Agent-state rail**: `StateTimeline` (vertical Listening/Thinking/Saving/Speaking + appended
  reconnect events, clean dots + active highlight) is BUILT but MOUNTED NOWHERE. The rooms show
  only the compact one-line `AgentStateIndicator`. Gap: the vertical rail (mockup item 3) is not
  shown anywhere. Biggest concrete win.
- **Captured-live cards**: `CapturedLivePanel` already has icon tiles + "Just added"(spinner)/
  "Saved"(check) + count footer. Admin-only (R1). Footer shows count; orders show "· 82%"
  (coverage) — coverage is admin vocabulary and dormant (coverage_routing off), so I will NOT
  fabricate a %; flag.
- **Reconnect pills**: `ReconnectBanner` exists (trying/recovered) — reasonable but flat; orders
  want "card" styling (mockup 4). Polish.
- **Welcome 3-box**: `ConsentLanding` = heading + intro + TWO stacked `Block` cards (what-it-is /
  handling) + one button. Orders want THREE boxes (What Nexus will learn / After the call /
  Privacy) + hero orb + a "Preview questions" secondary button + calmer spacing. The 3rd box
  ("After the call") needs copy from consentCopy() — copy is locked-compliance territory; I will
  restructure DISPLAY and reuse existing copy, flag any net-new consent sentence for Kaan+Emre.
- **Sim/real/context = one family**: LiveRoom already the shared frame (sim uses hideCaptured +
  marker). Parity comes for free once the family is polished; verify the sim room at the end.

## Per-surface plan (A28 pre-review each, own revertable commit, verify 1440+390)
1. Mount `StateTimeline` vertical rail (admin/observer presence area + voice presence) — the
   built-but-unmounted rail. Respondent shell keeps the compact line + count pill (R1 calm).
2. Context-call welcome hero orb + 3-box restructure + Preview-questions button (display only).
3. Captured-live card polish to mockup (icon tile / states / footer), admin shell only.
4. Reconnect pills → card styling (mockup 4).
5. Presence orb usage audit (ensure no "bare disc" path; welcome + both rooms use ParticleOrb).
6. Sim-room parity pass + both-width verify.

## A28 pre-reviews
- (added per surface before each change)

## Verdicts
- (added as surfaces land)
