"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mic, MessageSquare, Plus, StickyNote } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { confidenceForTag } from "@/lib/trust";
import { cn } from "@/lib/cn";
import {
  observe_session,
  add_observer_insight,
  type ObserverState,
  type CoverageObjective,
} from "@/lib/live";
import { ParticleOrb, type OrbState } from "./ParticleOrb";

// The Observer view (A19): the admin's live window onto one interview — the SAME elements
// as the respondent room (orb, transcript) inside the admin shell (correction #2), plus
// timestamped insight cards, a topics-covered ring, and Add insight.
//
// Honesty rules this surface is built on:
// - Badges come ONLY from the real trust ladder (correction #1): observer insights are
//   CLAIMED at the data layer → they render as "Reported", never anything stronger. Post-
//   compile claims carry their true tags through confidenceForTag. Nothing is "Verified"
//   unless the compiler independently corroborated it.
// - The orb here has NO audio feed (the call runs respondent↔voice-provider). It reflects
//   only real polled signal: session status + a pulse when a new utterance lands. We never
//   fabricate amplitude the observer isn't hearing.
// - The topics ring renders ONLY the coverage map the turn engine actually computed. When
//   coverage tracking is off (or hasn't run), we say "not tracked" — never an empty-but-
//   confident ring.
// - People are initials chips, never photos (correction #3).

const POLL_MS = 4000;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const SESSION_STATUS: Record<string, { label: string; pill: string }> = {
  completed: { label: "Completed", pill: "bg-success-soft text-tag-confirmed" },
  active: { label: "Live", pill: "bg-accent-soft text-accent-ink" },
  paused: { label: "Paused", pill: "bg-pain-moderate text-tag-guess" },
  pending: { label: "Not started", pill: "bg-surface-sunken text-ink-soft" },
  expired: { label: "Expired", pill: "bg-surface-sunken text-ink-faint" },
};

export function ObserverView({
  workspaceId,
  sessionId,
  initial,
}: {
  workspaceId: string;
  sessionId: string;
  initial: ObserverState;
}) {
  const [state, setState] = useState<ObserverState>(initial);
  const [pollError, setPollError] = useState(false);
  // Real-signal orb pulse: bump volume briefly when a NEW utterance arrives in a poll.
  const [pulse, setPulse] = useState(0);
  const lastCount = useRef(initial.utterances.length);
  const scroller = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await observe_session(workspaceId, sessionId);
      setPollError(false);
      setState(next);
      if (next.utterances.length > lastCount.current) {
        lastCount.current = next.utterances.length;
        setPulse(0.55); // a real event just landed
        window.setTimeout(() => setPulse(0), 900);
      }
    } catch {
      setPollError(true); // shown honestly; stale data stays labeled by the pill
    }
  }, [workspaceId, sessionId]);

  useEffect(() => {
    if (state.session.status !== "active" && state.session.status !== "pending") return;
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh, state.session.status]);

  useEffect(() => {
    const el = scroller.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [state.utterances.length]);

  const s = state.session;
  const name = s.interviewee ?? "Interviewee";
  const status = SESSION_STATUS[s.status] ?? { label: s.status, pill: "bg-surface-sunken text-ink-soft" };
  const live = s.status === "active";
  const orbState: OrbState = live ? "listening" : "connecting";
  const ModalityIcon = s.modality === "voice" ? Mic : MessageSquare;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      {/* Header — initials chip (never a photo), role, honest status pill. */}
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-ink">{name}</h1>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-faint">
            {s.interviewee_role && <span>{s.interviewee_role} · </span>}
            <ModalityIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="capitalize">{s.modality} interview</span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ring-ink/[0.04]",
            status.pill,
          )}
        >
          {live && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {status.label}
        </span>
        {pollError && (
          <span className="text-xs text-ink-faint">Connection hiccup — retrying…</span>
        )}
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Left: the room — same elements as the respondent side, admin chrome around. */}
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-card bg-[#1c1712] px-6 py-6 shadow-elev-2 ring-1 ring-inset ring-white/[0.06]">
            <div className="mx-auto h-40 w-40">
              <ParticleOrb volume={pulse} state={orbState} />
            </div>
            <p className="mt-2 text-center text-xs text-white/40">
              {live
                ? "Conversation in progress — the orb pulses as turns land"
                : s.status === "completed"
                  ? "Conversation ended"
                  : "Waiting for the conversation to start"}
            </p>
          </div>

          {/* Verbatim transcript, timestamped. */}
          <div
            ref={scroller}
            className="card-hairline mt-4 max-h-[46vh] min-h-[10rem] overflow-y-auto rounded-card border border-line bg-surface p-4"
          >
            {state.utterances.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">
                No turns yet. The transcript appears here as the conversation happens.
              </p>
            ) : (
              <div className="space-y-3">
                {state.utterances.map((u) => (
                  <div key={u.turn_index} className="flex gap-3">
                    <span className="mt-0.5 w-12 shrink-0 text-right text-[11px] tabular text-ink-faint">
                      {timeOf(u.at)}
                    </span>
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-[0.08em]",
                          u.speaker === "agent" ? "text-accent-ink" : "text-ink-soft",
                        )}
                      >
                        {u.speaker === "agent" ? "Interviewer" : name}
                      </span>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink">{u.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail: topics ring + insight cards + Add insight. */}
        <aside className="space-y-5">
          <TopicsCovered
            objectives={state.objectives}
            coverage={state.coverage}
            trackingEnabled={state.coverage_tracking_enabled}
          />
          <InsightRail
            workspaceId={workspaceId}
            sessionId={sessionId}
            state={state}
            onAdded={refresh}
          />
        </aside>
      </div>
    </div>
  );
}

// ── Topics-covered ring ────────────────────────────────────────────────────────
// Renders the engine-computed coverage map when one exists. When tracking is off (the
// coverage_routing flag) or no map has been computed, we show the planned topics WITHOUT
// coverage claims and say so — an empty ring would silently read as "nothing covered",
// and a full one would be a lie in the other direction.
function TopicsCovered({
  objectives,
  coverage,
  trackingEnabled,
}: {
  objectives: Array<string | CoverageObjective>;
  coverage: { objectives?: CoverageObjective[] } | null;
  trackingEnabled: boolean;
}) {
  const covered = coverage?.objectives ?? null;
  const counts = useMemo(() => {
    if (!covered) return null;
    const c = { satisfied: 0, partial: 0, untouched: 0 };
    for (const o of covered) c[o.status ?? "untouched"] += 1;
    return c;
  }, [covered]);

  const labels: Array<{ label: string; status?: CoverageObjective["status"] }> = covered
    ? covered.map((o) => ({ label: o.label, status: o.status ?? "untouched" }))
    : objectives.map((o) => (typeof o === "string" ? { label: o } : { label: o.label }));

  return (
    <section className="card-hairline rounded-card border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
        Topics covered
      </h2>

      {counts && covered ? (
        <div className="mt-3 flex items-center gap-4">
          <CoverageRing counts={counts} total={covered.length} />
          <dl className="space-y-1 text-xs text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> {counts.satisfied} covered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" /> {counts.partial} partly
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-line-strong" /> {counts.untouched} not yet
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          {trackingEnabled
            ? "Coverage appears once the conversation starts."
            : "Live coverage tracking is off — these are the planned topics."}
        </p>
      )}

      {labels.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {labels.map((o, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink">
              {o.status ? (
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    o.status === "satisfied"
                      ? "bg-success"
                      : o.status === "partial"
                        ? "bg-accent"
                        : "bg-line-strong",
                  )}
                />
              ) : (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong" />
              )}
              <span className="min-w-0">{o.label}</span>
            </li>
          ))}
        </ul>
      )}
      {labels.length === 0 && !counts && (
        <p className="mt-2 text-xs text-ink-faint">No objectives on this session.</p>
      )}
    </section>
  );
}

function CoverageRing({
  counts,
  total,
}: {
  counts: { satisfied: number; partial: number; untouched: number };
  total: number;
}) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const seg = (n: number) => (total > 0 ? (n / total) * C : 0);
  const satisfied = seg(counts.satisfied);
  const partial = seg(counts.partial);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img"
         aria-label={`${counts.satisfied} of ${total} topics covered`}>
      <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" className="stroke-line" />
      {partial > 0 && (
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
                className="stroke-accent"
                strokeDasharray={`${satisfied + partial} ${C - satisfied - partial}`}
                transform="rotate(-90 36 36)" />
      )}
      {satisfied > 0 && (
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
                className="stroke-success"
                strokeDasharray={`${satisfied} ${C - satisfied}`}
                transform="rotate(-90 36 36)" />
      )}
      <text x="36" y="40" textAnchor="middle" className="fill-ink font-display" fontSize="15">
        {counts.satisfied}/{total}
      </text>
    </svg>
  );
}

// ── Insight rail ───────────────────────────────────────────────────────────────
function InsightRail({
  workspaceId,
  sessionId,
  state,
  onAdded,
}: {
  workspaceId: string;
  sessionId: string;
  state: ObserverState;
  onAdded: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [addError, setAddError] = useState(false);

  async function add() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    setAddError(false);
    try {
      await add_observer_insight(workspaceId, sessionId, text);
      setDraft("");
      setComposerOpen(false);
      await onAdded();
    } catch {
      setAddError(true); // keep the draft — honest failure, nothing lost
    } finally {
      setAdding(false);
    }
  }

  // Live observer notes and post-compile claims in one timestamped rail; each card's
  // badge comes from the real ladder mapping — never assigned here by hand.
  const cards = [
    ...state.insights.map((i) => ({
      key: `note-${i.id}`,
      text: i.text,
      tag: i.trust_tag,
      at: i.at,
      kind: "Live note" as const,
      quote: null as string | null,
    })),
    ...state.claims.map((c) => ({
      key: `claim-${c.id}`,
      text: c.text,
      tag: c.tag,
      at: c.at,
      kind: "Compiled" as const,
      quote: c.evidence_quote,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section className="card-hairline rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Insights
        </h2>
        <button
          onClick={() => setComposerOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add insight
        </button>
      </div>

      {composerOpen && (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder="What did you just notice? Saved as a live note (reported, single voice)."
            className="input resize-none text-sm"
          />
          {addError && (
            <p className="mt-1 text-xs text-danger">Couldn&apos;t save — your note is still here, try again.</p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setComposerOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={add}
              disabled={!draft.trim() || adding}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent disabled:opacity-50"
            >
              {adding && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
              Save note
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="mt-4 flex flex-col items-center py-6 text-center">
          <StickyNote className="h-6 w-6 text-ink-faint/60" strokeWidth={1.5} />
          <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-ink-faint">
            Nothing here yet. Notes you add live appear as{" "}
            <span className="font-medium">Reported</span>; stronger tiers only come from the
            compiled record.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {cards.map((c) => (
            <motion.li
              key={c.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-line bg-surface-sunken/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] tabular text-ink-faint">
                  {timeOf(c.at)} · {c.kind}
                </span>
                <ConfidenceBadge confidence={confidenceForTag(c.tag)} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{c.text}</p>
              {c.quote && (
                <p className="mt-1.5 border-l-2 border-line pl-2 text-xs italic leading-relaxed text-ink-soft">
                  &ldquo;{c.quote}&rdquo;
                </p>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
