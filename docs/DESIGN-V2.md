# Design System V2 — proposal (task #18, pre-reset research + tokens)

**Status:** proposal for Kaan review. Nothing here is applied yet. Per A16/V2-PLAN the
gate stands: at the 3AM trigger I rebuild the **Snapshot screen alone** to this bar, we
screenshot-review together, then it replicates (#19). A15.3 compare loop governs.

**Constraint honored:** keep the warm cream/orange identity — this is an *evolution*, not
a reskin. Everything below deepens what's already in `globals.css`; no token is discarded,
several are added.

---

## 1. Research read — what makes the reference bar feel premium

From motionsites.ai (motion) + the Linear/Notion/Vercel-Geist/Stripe vocabulary Kaan named:

- **Elevation is layered, not blurred.** Premium surfaces stack 2–3 low-opacity shadows
  (a tight contact shadow + a soft ambient one) instead of one big fuzzy drop. The eye
  reads "lifted," never "glowy."
- **Borders are hairlines with a light top edge.** 1px, low-contrast, often a hair
  lighter at the top (a faux inner highlight) so cards feel like physical cards.
- **Glass = blur + translucency + a 1px highlight**, used sparingly on things that float
  over content (the drawer, the top bar, sticky rails), never on everything.
- **Type does the heavy lifting.** A real scale (not 5 ad-hoc sizes), tight tracking on
  display, generous leading on body, uppercase labels with `+0.08em` and reduced opacity.
- **Neutrals are hue-biased**, not pure grey — warm greys that lean toward the cream, so
  nothing reads as "default Tailwind."
- **Motion is fast and restrained.** App UI is ~150–260ms (not the 600–800ms of a
  landing page), ease-out, with 40–60ms stagger on lists. Motion marks *state changes*
  (a badge upgrading, a card arriving, a drawer sliding) — never decoration.
- **Micro-detail is the tell.** Visible focus rings, 1px alignment, `tabular-nums` on
  data, hover states that move ~1px or shift a shadow, keyboard affordances. This is the
  "Linear-grade" layer — invisible until absent.

Deliberately **not** doing: gradients-for-their-own-sake, neon, oversized hero, glass on
everything, parallax. Those read as templated, not designed (and violate Emre's density rule).

---

## 2. Token system V2

Proposed additions/edits to `src/app/globals.css` `:root` + `tailwind.config.ts`. Existing
token names are kept; **new** ones are marked.

### 2.1 Color — warmer, with depth

```
/* Canvas + surfaces (slightly warmer, and a real surface ladder) */
--canvas:        #f7f2e9;   /* was #faf6ef — a touch deeper so white cards lift */
--surface:       #fffdf8;   /* card face */
--surface-raised:#fffefb;   /* NEW hover/raised face */
--surface-sunken:#f2ece0;   /* NEW wells: inputs, code, inset areas */

/* Glass (NEW) — for the drawer, top bar, sticky rails only */
--glass:         rgb(255 253 248 / 0.72);
--glass-border:  rgb(255 255 255 / 0.55);
--glass-blur:    14px;

/* Ink — unchanged, already warm */
--ink:#1f1a13; --ink-soft:#5c5347; --ink-faint:#94897a;

/* Accent — keep the orange; add a brighter hover + a ring */
--accent:#e8641b; --accent-soft:#fdeadd; --accent-ink:#9c3d08;
--accent-hover:  #f0762f;   /* NEW */
--accent-ring:   rgb(232 100 27 / 0.35);   /* NEW focus ring */

/* Hairline borders (NEW top-lighter pair for card highlight) */
--border:#e6ddcd; --border-strong:#d6cbb8;
--hairline-top:  rgb(255 255 255 / 0.7);   /* NEW faux inner highlight */

/* Trust/pain/semantic tokens: unchanged (F35/A2 locked — do not touch). */
```

### 2.2 Elevation — a 4-step layered shadow scale (NEW)

Replaces the single `--shadow-card`. Each level is two stacked shadows (contact + ambient),
tuned warm (ink-tinted, not black).

```
--elev-0: none;
--elev-1: 0 1px 2px rgb(31 26 19 / .05), 0 1px 1px rgb(31 26 19 / .04);
--elev-2: 0 1px 3px rgb(31 26 19 / .06), 0 6px 16px rgb(31 26 19 / .06);   /* cards */
--elev-3: 0 2px 6px rgb(31 26 19 / .08), 0 16px 40px rgb(31 26 19 / .10);  /* drawer/modal */
--elev-4: 0 4px 12px rgb(31 26 19 / .10), 0 30px 70px rgb(31 26 19 / .14); /* command menu */
```
Cards go `--elev-1` at rest → `--elev-2` on hover (the 1px-lift micro-interaction).

### 2.3 Type — a real scale + tracking (keep Fraunces + Inter)

```
--step--1: .8125rem;  /* 13px captions/labels */
--step-0:  .9375rem;  /* 15px body (up from 14) */
--step-1:  1.0625rem; /* 17px lead */
--step-2:  1.375rem;  /* 22px card titles */
--step-3:  1.875rem;  /* 30px section */
--step-4:  2.75rem;   /* 44px page title */
--step-5:  3.75rem;   /* 60px hero */
/* tracking: display -0.02em; labels +0.08em uppercase; body 0 */
/* leading: display 1.05; headings 1.15; body 1.6 */
```
Numbers/timestamps: `font-variant-numeric: tabular-nums`.

### 2.4 Radius + spacing

```
--radius-chip:999px; --radius-sm:8px; --radius-md:11px; --radius-card:16px; --radius-xl:22px;
/* spacing stays on a 4px base; density multiplier below */
```

### 2.5 Density control (NEW — Notion-style)

A single attribute on the app root drives comfortable vs compact, so Emre's "5-minutes
to parse" test has a dial instead of a rebuild.

```
:root { --density: 1; }               /* comfortable (default) */
:root[data-density="compact"] { --density: .8; }
/* components read padding/gap as calc(<base> * var(--density)) */
```

### 2.6 Motion vocabulary (NEW — this is the big gap in V1)

```
--dur-instant:90ms; --dur-fast:150ms; --dur-base:220ms; --dur-slow:320ms;
--ease-standard: cubic-bezier(.2,0,0,1);      /* ui default (ease-out) */
--ease-entrance: cubic-bezier(.16,1,.3,1);    /* arrivals — decel, slight overshoot feel */
--ease-exit:     cubic-bezier(.4,0,1,1);
--spring: linear(...) /* framer spring for panels: stiffness ~380, damping ~32 */
--stagger: 45ms;      /* list-item cascade */
```
Rules: badges/chips animate on tier change (`--dur-fast`); cards arrive with a 6px rise +
fade (`--dur-base`, `--ease-entrance`, `--stagger`); drawer/modal slide with the spring;
hover = shadow `--elev-1`→`--elev-2` + 1px translate (`--dur-fast`). Respect
`prefers-reduced-motion` (drop transforms, keep opacity). Nothing loops.

---

## 3. Library calls (import only where earned)

- **framer-motion** — already in. It's the motion engine; add a shared `variants.ts`
  (rise, stagger, drawer-spring, badge-pop) so motion is consistent, not per-component.
- **No new heavy libs for the Snapshot pass.** Glass is CSS `backdrop-filter`; elevation
  is CSS; density is CSS. 3D (`three`/`@react-three`) is deferred to the knowledge-graph
  view only (A3 "wow" surface) — it earns weight there, nowhere else yet.
- Icons stay lucide.

---

## 4. Component-level change list (what the Snapshot rebuild proves first)

Ordered by where the "10k" read lands hardest. Each is a token swap + micro-detail, not
a re-architecture — the component API/props don't change.

1. **AppShell / top bar + left nav** → glass top bar (`--glass` + blur, hairline bottom),
   nav items get a resting/hover/active tri-state with a soft active pill + 1px indent
   motion; user block gets the elevation + a real avatar ring.
2. **Card primitive (Learned / Area / Person)** → `--elev-1`→`--elev-2` hover lift,
   `--hairline-top` highlight, `--radius-card`, arrival stagger. Source-icon circle gets
   a subtle inner shadow.
3. **ConfidenceBadge / PainBandChip / DiscoveryTag** → tighter type, `tabular` where
   numeric, badge-pop on change (`--dur-fast`), calmer fills. (Semantics untouched — F35/A2.)
4. **AreaDrawer** → the flagship glass surface: `--glass` panel + blur over a warmer
   scrim, spring slide-in, section reveals staggered, the signal stat-boxes get the
   elevation + a refined mini-bar. This is the screenshot that sells the bar.
5. **EvidenceQuoteCard** → quieter card, the quote mark as a subtle accent, timestamp
   `tabular-nums`, hover reveals the transcript-link affordance.
6. **Section headers / eyebrows** → the type-scale + `+0.08em` uppercase labels; counts
   as `tabular` pills.
7. **Next Recommended Action banner** → accent-tint glass, the rocket in an elevated
   token circle, button gets `--accent-hover` + ring.
8. **Evidence rail** → sticky with a soft top fade mask so it reads as a rail, not a column.
9. **Global** → focus-visible rings (`--accent-ring`) on every interactive element,
   `prefers-reduced-motion` guard, density attribute wired but defaulting comfortable.

**Acceptance for the gate:** Snapshot rebuilt with 1–4 fully, screenshot vs the current
V1 Snapshot side by side; the diff should read as "same product, a tier up" — warmer,
deeper, alive on interaction — with density unchanged (Emre's rule) and zero semantic drift.

---

## 5. Open taste calls for Kaan (batched)

- **Canvas depth:** `#faf6ef`→`#f7f2e9` (proposed) makes white cards lift more; if it reads
  too tan, we hold at current and lean on elevation instead. (my pick: go slightly deeper.)
- **Glass scope:** drawer + top bar + sticky rails only (my pick), or also on cards
  (I'd say no — cards over cream don't need it and it costs perf/legibility).
- **Motion intensity:** the arrival stagger + hover lift are the floor; do we want a
  one-time page-load orchestration on Snapshot (sections cascade once), or is per-card
  arrival enough? (my pick: subtle one-time cascade on first load, nothing on nav-back.)
- **Density default:** comfortable for the demo (my pick); compact available behind the
  attribute for dense clients later.
