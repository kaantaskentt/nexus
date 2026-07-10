"use client";

import { Activity, Loader2 } from "lucide-react";

// The live room frame (SIMPLIFY E, image20/19). ONE layout for both modes — voice and text
// are modes of this room, not two rooms. This is the RESPONDENT room (/i/token, rendered in
// the calm Shell with no workspace nav): the main column owns the conversation — a
// presence/mode header, the transcript (which owns the page, non-negotiable #5), and docked
// controls. The admin/observer surface is ObserverView, which keeps the rich Captured-live
// panel and does NOT use this frame.
//
// R1 audience split (Kaan): the respondent sees ONLY that capture is happening — a bare
// COUNT ("21 items captured") + the real extraction heartbeat, beside the presence bar's
// waveform (voice) / the agent-state rail (text). It NEVER sees the captured items; a
// respondent who watches their words become records starts performing for the record
// (Emre). The count-only cut is enforced at the data layer (the by-token payload has no
// item content), so there is no item list to render here at all.
//
// Responsive (Kaan tests 1440 AND 390): a single conversation column at every width — no
// content aside to dock or collapse — with the count pill above the controls.

export function LiveRoom({
  header,
  children,
  controls,
  capturedCount,
  capturing = false,
  banner,
  hideCaptured = false,
}: {
  header: React.ReactNode; // presence bar (voice) or mode header (text)
  children: React.ReactNode; // the transcript / message thread — owns the column
  controls: React.ReactNode; // docked bottom: Mute/Switch/End (voice) or composer (text)
  capturedCount: number; // how many structural items Nexus has saved — a COUNT, never content
  capturing?: boolean; // a real in-flight extraction — pulses the heartbeat, never faked
  banner?: React.ReactNode; // the reconnecting pill (F, COMMIT 4) — unobtrusive, in-room
  // SIMPLIFY I: a simulation suppresses the capture readout entirely (a practice run shows
  // the interviewer's performance, not "captured context"). The persistent practice-run
  // MARKER lives at the Shell level so it shows on every screen, not just here.
  hideCaptured?: boolean;
}) {
  return (
    // The room fills the viewport below the header. A simulation (hideCaptured) also carries
    // the persistent Shell marker bar above it, so reserve for that too — keeps the docked
    // controls on-screen. Non-simulation rooms are unchanged (the seam-2-verified height).
    <div
      className={
        "flex " + (hideCaptured ? "h-[calc(100vh-6.5rem)]" : "h-[calc(100vh-4rem)]")
      }
    >
      {/* Main column — the conversation, full width (no content aside). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0">{header}</div>

        {banner && <div className="shrink-0 pt-3">{banner}</div>}

        {/* Transcript owns the space between header and controls. */}
        <div className="min-h-0 flex-1 overflow-hidden py-4">{children}</div>

        {/* Docked controls, with the bare capture count above (hidden in a simulation). */}
        <div className="shrink-0 border-t border-line pt-3">
          {!hideCaptured && (
            <div className="mb-2 flex justify-end">
              <CaptureCount count={capturedCount} capturing={capturing} />
            </div>
          )}
          {controls}
        </div>
      </div>
    </div>
  );
}

// The respondent's only window onto capture: a live count + an honest heartbeat. No item
// content — proves the agent is alive and working without asking the respondent to perform.
function CaptureCount({ count, capturing }: { count: number; capturing: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint">
      {capturing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={2} />
      ) : (
        <Activity className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
      )}
      {count} {count === 1 ? "item" : "items"} captured
    </span>
  );
}
