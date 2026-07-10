"use client";

import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";

// The live room's agent-state indicator (SIMPLIFY E, image20/19). Listening / Thinking /
// Saving / Speaking, plus the two connection states F wires in (Reconnecting / Reconnected).
//
// HONESTY (task E): every state is DERIVED FROM A REAL EVENT, never faked —
//   voice: VAPI speech-start/end + transcript events (listening/thinking/speaking);
//   text:  the SSE stream state (thinking before first token, speaking while streaming);
//   saving: a real in-flight extraction job (the panel's `extracting` signal);
//   reconnecting/reconnected: the VAPI drop + resume path (COMMIT 4).
// The room owns the derivation; this component only renders what it is told.

export type RoomAgentState =
  | "listening"
  | "thinking"
  | "saving"
  | "speaking"
  | "reconnecting"
  | "reconnected";

const COPY: Record<RoomAgentState, { label: string; hint: string }> = {
  listening: { label: "Listening", hint: "Go ahead, take your time" },
  thinking: { label: "Thinking", hint: "Considering what you said" },
  saving: { label: "Saving", hint: "Noting what you shared" },
  speaking: { label: "Speaking", hint: "" },
  reconnecting: { label: "Reconnecting", hint: "Hang tight, back in a moment" },
  reconnected: { label: "Reconnected", hint: "Back together, continuing" },
};

// The ordered "timeline" spine the room shows on the right of the presence area (image20).
// Connection states only appear once they have happened, so they're not in the base spine.
const SPINE: RoomAgentState[] = ["listening", "thinking", "saving", "speaking"];

function dotClass(state: RoomAgentState, active: boolean): string {
  if (!active) return "bg-line-strong";
  switch (state) {
    case "speaking":
      return "bg-accent";
    case "thinking":
    case "saving":
      return "bg-accent/70";
    case "reconnecting":
      return "bg-accent";
    case "reconnected":
      return "bg-success";
    default:
      return "bg-success"; // listening
  }
}

// Compact current-state line for the presence bar. Calm dot + label + hint; the dot pings
// while the line is live (listening/speaking) exactly like InterviewProgress, so the two
// read as one system.
export function AgentStateIndicator({ state }: { state: RoomAgentState }) {
  const copy = COPY[state];
  const pinging = state === "listening" || state === "speaking" || state === "reconnecting";
  const Icon = state === "saving" ? Loader2 : state === "reconnecting" ? RefreshCw : null;
  return (
    <div className="flex items-center gap-2 text-sm" aria-live="polite">
      <span className="relative flex h-2 w-2">
        {pinging && (
          <span
            className={
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 " +
              (state === "reconnecting" ? "bg-accent/40" : dotClass(state, true) + "/40")
            }
          />
        )}
        <span className={"relative inline-flex h-2 w-2 rounded-full " + dotClass(state, true)} />
      </span>
      {Icon && <Icon className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={1.75} />}
      <span className="font-medium text-ink">{copy.label}</span>
      {copy.hint && <span className="hidden text-ink-faint sm:inline">· {copy.hint}</span>}
    </div>
  );
}

// The vertical state timeline (image20, right of the orb). Shows the base spine with the
// current state accented, and — once they occur — the connection states appended in order,
// so a reconnect is visible in the history rather than a silent blip (F).
export function StateTimeline({
  current,
  connectionEvents = [],
}: {
  current: RoomAgentState;
  // Ordered connection events as they happened this session (F, COMMIT 4).
  connectionEvents?: ("reconnecting" | "reconnected")[];
}) {
  const rows: RoomAgentState[] = [...SPINE, ...connectionEvents];
  return (
    <ul className="space-y-2.5">
      {rows.map((s, i) => {
        const active = s === current;
        return (
          <motion.li
            key={`${s}-${i}`}
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: active ? 1 : 0.5, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5 text-sm"
          >
            <span className={"h-2 w-2 shrink-0 rounded-full " + dotClass(s, active)} />
            <span className={active ? "font-medium text-ink" : "text-ink-faint"}>
              {COPY[s].label}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
