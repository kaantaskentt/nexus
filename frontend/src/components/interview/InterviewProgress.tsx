"use client";

import type { OrbState } from "./VoiceOrb";

// Respondent-side live progress — DELIBERATELY NEUTRAL (MERGE_PLAN A18, binding).
//
// A18 / [EMRE-SEAM]: showing a person what is being *captured* as they speak triggers
// self-censorship (demand characteristics / observer effect) — they start managing the
// record instead of describing the work. So the respondent NEVER sees a claims ticker.
// What they see here is only neutral process:
//   - a listening / thinking / speaking state (real, from VAPI speech + transcript events)
//   - time remaining (real, a timer against the plan's estimate)
//
// The admin-side live view is the opposite and MAY show captured points — that is a
// different component in a different lane, not this one.
//
// EMRE-SEAM: `coverage` is the clean seam A18 anticipates. It is undefined today on
// purpose — VAPI gives us no honest live topic-coverage signal, and faking advancing
// ticks would be exactly the self-censorship risk A18 forbids. If Emre's doc (or a real
// backend coverage signal) later defines neutral "areas covered" ticks, pass it here and
// only the neutral X-of-Y area count renders. Never wire this to captured claims/content.

const STATE_COPY: Record<OrbState, { label: string; hint: string }> = {
  connecting: { label: "Connecting", hint: "Opening the line" },
  listening: { label: "Listening", hint: "Go ahead, take your time" },
  thinking: { label: "Thinking", hint: "Considering what you said" },
  speaking: { label: "Speaking", hint: "" },
};

function timeRemaining(elapsedSec: number, estSec: number): string {
  const left = Math.round((estSec - elapsedSec) / 60);
  if (left >= 2) return `about ${left} min left`;
  if (left >= 1) return "about a minute left";
  if (elapsedSec < estSec) return "almost there";
  return "no rush, wrap up when you're ready";
}

export function InterviewProgress({
  state,
  elapsedSec,
  estSec,
  coverage,
}: {
  state: OrbState;
  elapsedSec: number;
  estSec: number;
  // EMRE-SEAM — neutral topic coverage only; undefined until a real signal exists.
  coverage?: { covered: number; total: number };
}) {
  const copy = STATE_COPY[state];
  const frac = Math.max(0, Math.min(1, estSec > 0 ? elapsedSec / estSec : 0));

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-sm">
        <StateDot state={state} />
        <span className="font-medium text-ink">{copy.label}</span>
        {copy.hint && <span className="text-ink-faint">· {copy.hint}</span>}
      </div>

      {/* Neutral time ring — real elapsed vs the plan estimate, never a capture meter. */}
      <div className="flex items-center gap-2 text-xs text-ink-faint">
        <div
          className="h-1.5 w-40 overflow-hidden rounded-chip bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(frac * 100)}
          aria-label="Time elapsed"
        >
          <div
            className="h-full rounded-chip bg-accent/50 transition-[width] duration-1000 ease-linear"
            style={{ width: `${frac * 100}%` }}
          />
        </div>
        <span className="tabular-nums">{timeRemaining(elapsedSec, estSec)}</span>
      </div>

      {coverage && coverage.total > 0 && (
        <p className="text-xs text-ink-faint">
          Covering area {Math.min(coverage.covered, coverage.total)} of {coverage.total}
        </p>
      )}
    </div>
  );
}

function StateDot({ state }: { state: OrbState }) {
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  return (
    <span className="relative flex h-2 w-2">
      {(speaking || state === "listening") && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40" />
      )}
      <span
        className={
          "relative inline-flex h-2 w-2 rounded-full " +
          (speaking ? "bg-accent" : thinking ? "bg-accent/70" : "bg-success")
        }
      />
    </span>
  );
}
