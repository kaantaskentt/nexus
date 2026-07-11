"use client";

import { Activity, Loader2, WifiOff } from "lucide-react";
import { BrandMark } from "@/components";
import { StateTimeline, type RoomAgentState } from "./AgentStateIndicator";

// The live room frame (SIMPLIFY E, image20/19). ONE layout for both modes — voice and text
// are modes of this room, not two rooms. This is the RESPONDENT room (/i/token, rendered in
// the calm Shell with no workspace nav): the main column owns the conversation — a
// presence/mode header, the transcript (which owns the page, non-negotiable #5), and docked
// controls. The admin/observer surface is ObserverView, which keeps the rich Captured-live
// panel and does NOT use this frame.
//
// R1 audience split (Kaan): the respondent sees ONLY that capture is happening — the
// agent-state RAIL (Listening / Thinking / Saving / Speaking, + reconnect events) and a bare
// COUNT ("21 items captured") + the real extraction heartbeat. It NEVER sees the captured
// items; a respondent who watches their words become records starts performing for the
// record (Emre). The count-only cut is enforced at the data layer (the by-token payload has
// no item content), so there is no item list to render here at all.
//
// ROOM-PARITY (Kaan): the agent-state rail is the vertical StateTimeline (mockup 4), shown on
// the right at desktop width; below lg the room stays a single column and the compact state
// line + count ride above the controls. Pixel styling is a sensible default pending mockups.

export function LiveRoom({
  header,
  children,
  controls,
  capturedCount,
  capturing = false,
  captureFeedDegraded = false,
  agentState,
  connectionEvents = [],
  banner,
  hideCaptured = false,
}: {
  header: React.ReactNode; // presence bar (voice) or mode header (text)
  children: React.ReactNode; // the transcript / message thread — owns the column
  controls: React.ReactNode; // docked bottom: Mute/Switch/End (voice) or composer (text)
  capturedCount: number; // how many structural items Nexus has saved — a COUNT, never content
  capturing?: boolean; // a real in-flight extraction — pulses the heartbeat, never faked
  // July 11 honesty fix: the count poller reports consecutive fetch failures. When true,
  // the readout says "reconnecting" instead of freezing a stale number as if it were live —
  // the counter never fabricates, in either direction.
  captureFeedDegraded?: boolean;
  // The room's current agent state + any reconnect events this session — drives the vertical
  // rail. Omitted on surfaces that don't derive a state; the rail then simply doesn't render.
  agentState?: RoomAgentState;
  connectionEvents?: ("reconnecting" | "reconnected")[];
  banner?: React.ReactNode; // the reconnecting pill (F, COMMIT 4) — unobtrusive, in-room
  // SIMPLIFY I: a simulation suppresses the capture readout entirely (a practice run shows
  // the interviewer's performance, not "captured context"). The persistent practice-run
  // MARKER lives at the Shell level so it shows on every screen, not just here.
  hideCaptured?: boolean;
}) {
  const showRail = !hideCaptured && agentState !== undefined;
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

        {/* Docked controls. Below lg the bare capture count rides above them (the desktop
            rail carries it at wider widths). Hidden in a simulation. */}
        <div className="shrink-0 border-t border-line pt-3">
          {!hideCaptured && (
            <div className={"mb-2 flex justify-end " + (showRail ? "lg:hidden" : "")}>
              <CaptureCount count={capturedCount} capturing={capturing} degraded={captureFeedDegraded} />
            </div>
          )}
          {controls}
        </div>
      </div>

      {/* Agent-state rail — desktop only, respondent-safe (states + count, never content). */}
      {showRail && (
        <aside className="hidden w-[220px] shrink-0 flex-col border-l border-line pl-6 lg:flex">
          <div className="flex items-center gap-2 pb-4 pt-1">
            <BrandMark className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Nexus
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <StateTimeline current={agentState} connectionEvents={connectionEvents} />
          </div>
          <div className="border-t border-line pt-3">
            <CaptureCount count={capturedCount} capturing={capturing} degraded={captureFeedDegraded} />
          </div>
        </aside>
      )}
    </div>
  );
}

// The respondent's only window onto capture: a live count + an honest heartbeat. No item
// content — proves the agent is alive and working without asking the respondent to perform.
function CaptureCount({
  count,
  capturing,
  degraded = false,
}: {
  count: number;
  capturing: boolean;
  degraded?: boolean;
}) {
  // Feed down → say so. A number frozen behind a dead fetch reads as "nothing is being
  // captured", which is a lie in both directions; the dash + reconnecting is the truth.
  if (degraded) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint">
        <WifiOff className="h-3.5 w-3.5" strokeWidth={2} />
        &ndash;&ndash; reconnecting
      </span>
    );
  }
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
