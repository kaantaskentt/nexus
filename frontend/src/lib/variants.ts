// Shared framer-motion vocabulary (A16 motion spec). Motion marks STATE CHANGES —
// arrivals, drawer slides, badge tier shifts — never decoration, nothing loops.
// Durations/eases mirror the CSS tokens in globals.css so JS and CSS motion agree.
// prefers-reduced-motion is honored globally in globals.css (transforms collapse,
// opacity stays), so these variants stay simple.
import type { Transition, Variants } from "framer-motion";

const EASE_ENTRANCE = [0.16, 1, 0.3, 1] as const; // decel — cubic-bezier(.16,1,.3,1)
const EASE_STANDARD = [0.2, 0, 0, 1] as const;

// A card/section arriving: 8px rise + fade, decelerating.
export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_ENTRANCE } },
};

// Parent that cascades its children (45ms stagger — the "list arrives" feel).
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

// Drawer/modal panel — spring slide from the right (stiff, well-damped, no wobble).
// damping 38 ≈ critically damped at this stiffness/mass; the old 34 overshot a few px
// past rest, which read as clipped text mid-animation (Emre report #6, July 8).
export const drawerSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.9,
};

// Scrim behind a floating surface.
export const scrimFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22, ease: EASE_STANDARD } },
};

// Inner sections of a drawer, staggered once the panel has settled.
export const drawerSection: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_ENTRANCE } },
};
