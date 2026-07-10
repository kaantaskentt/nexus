# SIMPLIFY refine round — lane-design (Figma/Canva design-system alignment)

Mandate: screenshot every page at 1440+390, check each against the ONE cohesive Nexus
system (coded tokens = source of truth; Figma/Canva MCP not authed this session), align
divergences as strictly-visual scoped commits. A28 pre-review per surface; zero behavior.

## Connector status
- Figma MCP: NOT authenticated (needs Kaan /mcp → claude.ai Figma). Aligning against coded
  tokens (globals.css / variants.ts / DESIGN-V2.md), which the orders name source of truth.
- Canva MCP: absent this session. Deferred; was only ever for one-off assets.

## Sequence (team-lead confirmed)
1. globals.css token additions + shared primitives + AppShell (no collision).
2. WorkflowEditor / DiscoveryUpload title-scale (lane-c DONE, safe).
3. SnapshotView LAST (lane-dbg v2 landed; now clean/committed).

---

## Batch 1a — token foundation (additive, no visual risk)

**A28 pre-review**
- Today: dark call-room tiles use a magic hex `bg-[#1c1712]` (×3); the uppercase micro-label
  geometry (`text-[11px] tracking-[0.08em] uppercase`) is retyped inline across ~8 files;
  the 11px label tier and the dark surface aren't tokens; canvas orb/waveform colors are
  raw rgba with no link back to --accent.
- After: `--surface-dark` token + `bg-surface-dark` utility (identical color, now systemic);
  `--step--2` (11px) + `.eyebrow` utility defined for later adoption; canvas colors keep
  their exact rgba but carry a comment mirroring them to --accent so they don't drift.
- Simpler or more complex for the user? SIMPLER — zero pixels change now; this is plumbing
  that makes the later sweeps one-token edits instead of scattered magic values.

**Scope:** globals.css, tailwind.config.ts, ObserverView.tsx, VoiceCall.tsx, ParticleOrb.tsx,
MicWaveform.tsx. `.eyebrow`/`--step--2` are DEFINED here, applied in a later batch so the
visual sweep can be eyeballed rendered (not applied blind).

**Verify:** tsc clean · next lint clean · vitest 107/107 pass. `bg-[#1c1712]` → `bg-surface-dark`
is a byte-identical color swap (#1c1712 == var(--surface-dark)), safe pre-screenshot.

**Verdict:** LANDED. Foundation for the alignment sweeps. Browser-verify the dark tiles
still render on the call-room/observer surfaces during the screenshot pass (expected: no
visible change).

---

## Batch 2 — page-title size uniformity

**A28 pre-review**
- Today: page titles are all `<h1 font-display leading-[1.05]>` but the size diverges by
  surface. Most are text-[2.75rem] (=--step-4, the standard: Snapshot, Company Context,
  Interview Plan, Report, Interviews, Simulations, Trust, Workflows list, respondent).
  Five are off-scale at text-[2.5rem] (40px): Workflow detail title, DiscoveryUpload's two
  intro/building screens, and AssignInterviewFlow's "New interview" + "Assign interview".
- After: all five → text-[2.75rem], so every page title is one size.
- Simpler or more complex for the user? SIMPLER — a consistent title tier is one less
  visual inconsistency; a 4px lift, no layout/behavior impact.

**Scope:** WorkflowEditor.tsx, DiscoveryUpload.tsx (×2), AssignInterviewFlow.tsx (×2).

**Left intentionally:** AssignInterviewFlow:761 "A couple of quick questions" stays
text-[2rem] — it's a smaller inline-with-icon step heading inside the intake chat, a
deliberately lighter tier than a page title. Noting it rather than flattening it. (Minor:
2rem is 2px off --step-3/1.875rem; not worth a blind nudge — revisit in the screenshot pass.)

**Verify:** tsc clean · next lint clean · vitest 107/107. Render-verification of the 44px
titles lands at the next deploy's screenshot pass (prod screenshots still show pre-change).

**Verdict:** LANDED.
