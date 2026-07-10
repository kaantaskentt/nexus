"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { StageRail } from "@/components/interviews/StageRail";

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
  slug,
  initial,
}: {
  workspaceId: string;
  sessionId: string;
  // Optional so the badge-honesty tests can render without it; drives the StageRail Report
  // deep link (/w/[slug]/report/[sessionId]) when present.
  slug?: string;
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

  // The interview is ONE staged flow (Feedback-K): the Report stage is reachable once the
  // interview has completed (report route is keyed by session id). Plan/Follow-up ids aren't
  // in the observer payload, so those stages render in the rail but aren't deep-linked here.
  const stageHrefs =
    slug && s.status === "completed"
      ? { report: `/w/${slug}/report/${sessionId}` }
      : undefined;

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      {/* The interview as one connected workflow — Observe is lit, Report links when ready. */}
      <StageRail current="observe" hrefs={stageHrefs} className="mb-6" />

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
          <span className="text-xs text-ink-faint">Connection hiccup, retrying…</span>
        )}
      </header>

      {/* Topic coverage — a legible per-topic state strip, not an opaque ring. */}
      <TopicCoverage
        objectives={state.objectives}
        coverage={state.coverage}
        trackingEnabled={state.coverage_tracking_enabled}
      />

      {/* The room — transcript and Live notes share ONE bordered surface (two columns,
          a hairline between), so it reads as one connected page, not two stacked ones.
          Each column scrolls inside its own bounded height; the page barely scrolls. */}
      <div className="mt-5 grid overflow-hidden rounded-card border border-line lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col bg-surface">
          {/* Voice-presence strip (voice only): a slim version of the respondent orb —
              real signal only, pulses as turns land. Far shorter than the old dark box. */}
          {s.modality === "voice" ? (
            <div className="flex items-center gap-3 border-b border-line bg-[#1c1712] px-4 py-2.5">
              <div className="h-10 w-10 shrink-0">
                <ParticleOrb volume={pulse} state={orbState} />
              </div>
              <p className="text-xs leading-snug text-white/50">
                {live
                  ? "Conversation in progress. The orb pulses as turns land."
                  : s.status === "completed"
                    ? "Conversation ended. Verbatim transcript below."
                    : "Waiting for the conversation to start."}
              </p>
            </div>
          ) : (
            <div className="border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Transcript
            </div>
          )}

          {/* Verbatim transcript, timestamped. */}
          <div ref={scroller} className="max-h-[56vh] min-h-[16rem] flex-1 overflow-y-auto p-4">
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

        {/* Live notes — same surface, divided by a hairline (top on mobile, left on lg). */}
        <div className="flex min-w-0 flex-col border-t border-line bg-surface-sunken/30 lg:border-l lg:border-t-0">
          <InsightRail
            workspaceId={workspaceId}
            sessionId={sessionId}
            state={state}
            onAdded={refresh}
          />
        </div>
      </div>
    </div>
  );
}

// ── Topic coverage ─────────────────────────────────────────────────────────────
// A legible per-topic state strip (the opaque ring is retired). Each planned objective is a
// chip whose plain-language state comes ONLY from the coverage map the turn engine computed:
// Covered / Partly / Not yet from a real map, or Planned when live tracking is off (nothing is
// invented). An empty ring read as "nothing covered" and a full one lied the other way; a
// worded chip cannot. Renders nothing when there are no objectives.
const COVERAGE_STATE = {
  satisfied: { label: "Covered", dot: "bg-success", chip: "border-success/30 bg-success-soft text-tag-confirmed" },
  partial: { label: "Partly", dot: "bg-accent", chip: "border-accent/25 bg-accent-soft text-accent-ink" },
  untouched: { label: "Not yet", dot: "bg-line-strong", chip: "border-line bg-surface text-ink-soft" },
  planned: { label: "Planned", dot: "bg-line-strong", chip: "border-line bg-surface text-ink-soft" },
} as const;

type CoverageChipState = keyof typeof COVERAGE_STATE;

function TopicCoverage({
  objectives,
  coverage,
  trackingEnabled,
}: {
  objectives: Array<string | CoverageObjective>;
  coverage: { objectives?: CoverageObjective[] } | null;
  trackingEnabled: boolean;
}) {
  const covered = coverage?.objectives ?? null;
  // Real states only: when the engine computed a map, each topic carries its true status;
  // otherwise every topic is "Planned" (not yet measured). Nothing is invented.
  const items: Array<{ label: string; state: CoverageChipState }> = covered
    ? covered.map((o) => ({ label: o.label, state: (o.status ?? "untouched") as CoverageChipState }))
    : objectives.map((o) => ({ label: typeof o === "string" ? o : o.label, state: "planned" as const }));

  // No objectives on this session → show nothing, rather than a pile of negative sentences.
  if (items.length === 0) return null;

  const satisfied = items.filter((o) => o.state === "satisfied").length;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Topic coverage
        </h2>
        <span className="text-xs text-ink-faint">
          {covered
            ? `${satisfied} of ${items.length} covered`
            : trackingEnabled
              ? "Coverage appears once the conversation starts"
              : "Live coverage tracking is off, these are the planned topics"}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((o, i) => {
          const st = COVERAGE_STATE[o.state];
          return (
            <li
              key={i}
              className={cn(
                "inline-flex items-center gap-2 rounded-chip border px-2.5 py-1 text-sm",
                st.chip,
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
              <span className="min-w-0">{o.label}</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] opacity-70">
                {st.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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
    <section className="flex min-h-0 flex-col">
      {/* "Live notes" — renamed from "Insights" to kill the collision with the nav tab. */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Live notes
        </h2>
        <button
          onClick={() => setComposerOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add note
        </button>
      </div>

      {composerOpen && (
        <div className="border-b border-line px-4 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder="What did you just notice? Saved as a live note (reported, single voice)."
            className="input resize-none text-sm"
          />
          {addError && (
            <p className="mt-1 text-xs text-danger">Couldn&apos;t save. Your note is still here, try again.</p>
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

      <div className="max-h-[56vh] flex-1 overflow-y-auto px-4 py-3">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <StickyNote className="h-6 w-6 text-ink-faint/60" strokeWidth={1.5} />
            <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-ink-faint">
              Nothing here yet. Notes you add live appear as{" "}
              <span className="font-medium">Reported</span>; stronger tiers only come from the
              compiled record.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {cards.map((c) => (
              <motion.li
                key={c.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] tabular text-ink-faint">
                    {timeOf(c.at)} · {c.kind}
                  </span>
                  {/* Claims can be untagged (tag=null pre-adjudication) — same guard as the
                      Knowledge surfaces: no badge rather than a made-up tier. */}
                  {c.tag && <ConfidenceBadge confidence={confidenceForTag(c.tag)} />}
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
      </div>
    </section>
  );
}
