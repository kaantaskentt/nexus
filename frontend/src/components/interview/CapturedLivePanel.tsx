"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, Database, Waypoints, Scale, Target, HelpCircle, Check, Loader2, Activity,
} from "lucide-react";
import { BrandMark } from "@/components";
import brand from "@/lib/brand";
import { drawerSpring } from "@/lib/variants";
import type { LiveCaptureItem, LiveCaptureKind } from "@/lib/liveCaptures";

// The "Captured live" panel (SIMPLIFY E, image20/19). Shows the respondent, in real time,
// the STRUCTURAL items Nexus has SAVED from the conversation — honoring the consent promise
// that you can see what is captured. It is NEVER a claims ticker or a judgment surface:
//   - structural kinds only (teams / systems / workflows / decision rules / goals / open qs);
//   - respondent view carries NO confidence badge (A18: respondent surfaces stay neutral);
//   - the admin view MAY show the ladder badge (Reported at most for a live single source).
//
// The "Just added" spinner -> "Saved" checkmark is an honest ARRIVAL affordance, not a fake
// backend state: a row is persisted ('saved') the moment it exists; when the panel first
// SEES a new row it plays a brief drawerSpring entrance labelled "Just added", then settles
// to "Saved". Items present on first load render settled immediately (they are history).
// The header pulse reflects a REAL in-flight extraction job (`extracting`), never invented.

const KIND_META: Record<LiveCaptureKind, { icon: typeof Users; label: string }> = {
  team: { icon: Users, label: "Team" },
  system: { icon: Database, label: "System" },
  workflow: { icon: Waypoints, label: "Workflow" },
  decision_rule: { icon: Scale, label: "Decision rule" },
  goal: { icon: Target, label: "Goal" },
  open_question: { icon: HelpCircle, label: "Open question" },
};

const SETTLE_MS = 1100; // how long a fresh item reads "Just added" before it settles to "Saved"

export function CapturedLivePanel({
  items,
  extracting,
  variant = "respondent",
}: {
  items: LiveCaptureItem[];
  extracting: boolean;
  variant?: "respondent" | "admin";
}) {
  // Ids that have finished their "Just added" beat and now read "Saved".
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const known = settled;
    const fresh = items.filter((i) => !known.has(i.id));
    if (fresh.length === 0) return;
    if (firstLoad.current) {
      // Everything already on screen at mount is history — settle it immediately, no
      // theatrical replay of a conversation that already happened.
      firstLoad.current = false;
      setSettled(new Set(items.map((i) => i.id)));
      return;
    }
    // Genuinely new rows: let them read "Just added", then settle each to "Saved".
    fresh.forEach((i) => {
      const t = window.setTimeout(() => {
        setSettled((prev) => new Set(prev).add(i.id));
      }, SETTLE_MS);
      timers.current.push(t);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <BrandMark className="h-4 w-4 text-accent" />
          <span className="font-display text-base text-ink">Captured live</span>
        </div>
        {/* Header status: a real in-flight extraction pulses "Saving"; otherwise a calm
            "Live" heartbeat. Never a fabricated activity animation. */}
        {extracting ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Saving
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-faint">
            <Activity className="h-3.5 w-3.5 text-accent" strokeWidth={2} /> Live
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1">
        {items.length === 0 ? (
          <p className="px-1 py-8 text-sm leading-relaxed text-ink-faint">
            As you talk, the teams, systems, and workflows you describe show up here, so you
            can see exactly what {brand.product_name} is saving.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <CaptureCard
                key={item.id}
                item={item}
                settled={settled.has(item.id)}
                showBadge={variant === "admin"}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line px-1 pt-3 text-xs text-ink-faint">
        <span>
          {items.length} {items.length === 1 ? "item" : "items"} captured
        </span>
        {variant === "admin" && (
          <span className="text-ink-faint">Live capture · Reported (single source)</span>
        )}
      </div>
    </div>
  );
}

function CaptureCard({
  item,
  settled,
  showBadge,
}: {
  item: LiveCaptureItem;
  settled: boolean;
  showBadge: boolean;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={drawerSpring}
      className="card-hairline flex items-start gap-3 rounded-card border border-line bg-surface p-3"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-soft">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-ink">{item.label}</span>
          {settled ? (
            // Quiet confirmation, not celebration (Kaan taste note): a small check that
            // just fades in — no scale, no bounce.
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-tag-verified"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} /> Saved
            </motion.span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Just added
            </span>
          )}
        </div>
        {item.detail && (
          <p className="mt-0.5 text-sm leading-snug text-ink-soft">{item.detail}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-ink-faint">{meta.label}</span>
          {/* Admin only: the ladder badge. A live single-source item is Reported at most
              (A18/A19); the respondent view never shows this. */}
          {showBadge && item.ladder && (
            <span className="rounded-chip bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint ring-1 ring-inset ring-ink/[0.06]">
              {item.ladder}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
