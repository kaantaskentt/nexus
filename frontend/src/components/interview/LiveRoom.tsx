"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelRightOpen, X } from "lucide-react";
import { drawerSpring, scrimFade } from "@/lib/variants";

// The live room frame (SIMPLIFY E, image20/19). ONE layout for both modes and both
// audiences — voice and text are modes of this room, not two rooms:
//   - the main column owns the conversation: a presence/mode header, the transcript
//     (which owns the page, non-negotiable #5), and docked controls;
//   - the aside is the "Captured live" panel.
// This frame is purely presentational: the caller passes real nodes. VoiceCall feeds it
// the orb presence bar + LiveTranscript + call controls; the text client feeds it the
// mode header + message thread + composer. Respondent /i/token renders this inside its
// calm Shell (no workspace nav); workspace-side (Observer / in-workspace context call)
// renders it inside AppShell with the left nav KEPT.
//
// Responsive (Kaan tests 1440 AND 390): two columns on lg with the panel docked right;
// below lg the panel collapses behind a "Captured live · N" toggle so the phone screen
// stays on the conversation, one tap from what was saved.

export function LiveRoom({
  header,
  children,
  controls,
  capturedPanel,
  capturedCount,
  banner,
  hideCaptured = false,
}: {
  header: React.ReactNode; // presence bar (voice) or mode header (text)
  children: React.ReactNode; // the transcript / message thread — owns the column
  controls: React.ReactNode; // docked bottom: Mute/Switch/End (voice) or composer (text)
  capturedPanel: React.ReactNode; // <CapturedLivePanel />
  capturedCount: number;
  banner?: React.ReactNode; // the reconnecting pill (F, COMMIT 4) — unobtrusive, in-room
  // SIMPLIFY I: a simulation suppresses the Captured-live panel entirely (a practice run
  // shows the interviewer's performance, not "captured context"). The persistent practice-
  // run MARKER lives at the Shell level so it shows on every screen (consent/pre-call/room),
  // not just here.
  hideCaptured?: boolean;
}) {
  const [panelOpen, setPanelOpen] = useState(false); // mobile drawer

  return (
    // The room fills the viewport below the header. A simulation (hideCaptured) also carries
    // the persistent Shell marker bar above it, so reserve for that too — keeps the docked
    // controls on-screen. Non-simulation rooms are unchanged (the seam-2-verified height).
    <div
      className={
        "flex gap-0 lg:gap-6 " +
        (hideCaptured ? "h-[calc(100vh-6.5rem)]" : "h-[calc(100vh-4rem)]")
      }
    >
      {/* Main column — the conversation. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0">{header}</div>

        {banner && <div className="shrink-0 pt-3">{banner}</div>}

        {/* Transcript owns the space between header and controls. */}
        <div className="min-h-0 flex-1 overflow-hidden py-4">{children}</div>

        {/* Docked controls, plus the mobile "Captured live" toggle (hidden in a simulation). */}
        <div className="shrink-0 border-t border-line pt-3">
          {!hideCaptured && (
            <div className="mb-2 flex justify-end lg:hidden">
              <button
                onClick={() => setPanelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-raised"
              >
                <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                Captured live · {capturedCount}
              </button>
            </div>
          )}
          {controls}
        </div>
      </div>

      {/* Aside — docked on lg, a slide-over on mobile. Suppressed for a simulation. */}
      {!hideCaptured && (
        <aside className="hidden w-[340px] shrink-0 border-l border-line pl-6 lg:block">
          {capturedPanel}
        </aside>
      )}

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              variants={scrimFade}
              initial="hidden"
              animate="show"
              exit="hidden"
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 z-40 bg-ink/20 lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={drawerSpring}
              className="fixed inset-y-0 right-0 z-50 w-[86%] max-w-sm border-l border-line bg-canvas p-5 shadow-elev-2 lg:hidden"
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => setPanelOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
                  aria-label="Close captured panel"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="h-[calc(100%-2.5rem)]">{capturedPanel}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
