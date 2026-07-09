"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandMark } from "@/components";
import { displaySpokenText } from "@/lib/transcript-display";
import { drawerSpring } from "@/lib/variants";

// Live transcript for the voice room (task #40 Lane C). Shows the REAL conversation as it
// flows — finalized turns from VAPI `transcript` (final) messages, plus the in-progress
// line from `partial` messages in a lighter, italic style so "still being said" reads as
// exactly that. Nothing here is synthesized; if VAPI sends no transcript we show an honest
// listening hint rather than inventing text.

export type Turn = { role: "assistant" | "user"; text: string };

export function LiveTranscript({
  turns,
  partial,
}: {
  turns: Turn[];
  partial: Turn | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Scroll discipline (UI debate spec (c)-4): follow the conversation only when the
    // reader is already at the bottom — someone who scrolled up to reread must not be
    // yanked back down by the next turn.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;
    // scrollTo is absent in some environments (jsdom); fall back to scrollTop.
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, partial]);

  const empty = turns.length === 0 && !partial;

  return (
    <div
      ref={scroller}
      className="h-full space-y-3 overflow-y-auto px-1"
      aria-live="polite"
      aria-label="Live transcript"
    >
      {empty && (
        <p className="py-6 text-center text-sm text-ink-faint">
          Your conversation will appear here as you talk.
        </p>
      )}

      <AnimatePresence initial={false}>
        {turns.map((t, i) => (
          <TurnRow key={i} turn={t} />
        ))}
      </AnimatePresence>

      {partial && <TurnRow turn={partial} live />}
    </div>
  );
}

function TurnRow({ turn, live }: { turn: Turn; live?: boolean }) {
  const mine = turn.role === "user";
  return (
    <motion.div
      // Committed turns settle in with the app's own spring (drawerSpring: critically
      // damped, no overshoot — UI debate spec (c)-3); the in-progress line keeps the
      // calm flat tween. prefers-reduced-motion collapses transforms globally.
      initial={{ opacity: 0, y: live ? 6 : 10 }}
      animate={{ opacity: live ? 0.72 : 1, y: 0 }}
      transition={live ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] } : drawerSpring}
      className={mine ? "flex justify-end" : "flex gap-2.5"}
    >
      {!mine && <BrandMark className="mt-1 h-4 w-4 shrink-0 text-accent" />}
      <div
        className={
          "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
          (mine
            ? "rounded-tr-sm bg-accent text-on-accent"
            : "rounded-tl-sm bg-surface text-ink") +
          (live ? " italic" : "")
        }
      >
        {/* Display-layer only (P0-B): "tidy 1" renders "tidy one"; storage is verbatim. */}
        {displaySpokenText(turn.text)}
      </div>
    </motion.div>
  );
}
