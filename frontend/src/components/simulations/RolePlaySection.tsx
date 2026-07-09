"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Drama, ExternalLink, X, ClipboardList, Check, Minus, CircleDashed } from "lucide-react";
import type { RolePlayRun, SimulationCastMember } from "@/lib/live";
import {
  get_roleplay_brief,
  list_roleplay,
  request_roleplay_debrief,
  start_roleplay,
} from "@/lib/live";
import { scrimFade, drawerSpring } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";

// F8 "Jump in as the employee" (admin-only page): pick a cast character, read the
// playing brief, take the interview yourself in the normal room, come back for the
// observation debrief. Sessions are roleplay-kind: firewalled from real records
// server-side (compile and screening skip them).
export function RolePlaySection({
  workspaceId,
  cast,
  initialRuns,
}: {
  workspaceId: string;
  cast: SimulationCastMember[];
  initialRuns: RolePlayRun[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [briefFor, setBriefFor] = useState<SimulationCastMember | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDebrief, setPendingDebrief] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEscapeClose(Boolean(briefFor), () => setBriefFor(null));

  async function play(member: SimulationCastMember) {
    setBusyKey(member.key);
    setError(null);
    try {
      const [minted, b] = await Promise.all([
        start_roleplay(workspaceId, member.key),
        get_roleplay_brief(member.key),
      ]);
      setInvitePath(minted.invite_path);
      setBrief(b.sheet);
      setBriefFor(member);
      setRuns(await list_roleplay(workspaceId).catch(() => runs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The role-play could not be started.");
    } finally {
      setBusyKey(null);
    }
  }

  async function debrief(sessionId: string) {
    setError(null);
    try {
      const r = await request_roleplay_debrief(sessionId);
      if (r.status === "queued") {
        setPendingDebrief(sessionId);
      } else {
        setRuns(await list_roleplay(workspaceId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The debrief could not be requested.");
    }
  }

  // While a debrief is compiling, refresh the list every few seconds until it lands.
  useEffect(() => {
    if (!pendingDebrief) return;
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      const fresh = await list_roleplay(workspaceId).catch(() => null);
      if (fresh) {
        setRuns(fresh);
        const run = fresh.find((r) => r.session_id === pendingDebrief);
        if (run?.debrief || ticks > 40) setPendingDebrief(null);
      }
      if (ticks > 40 && pollRef.current) clearInterval(pollRef.current);
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingDebrief, workspaceId]);

  const castByKey = new Map(cast.map((c) => [c.key, c]));

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
        <Drama className="h-4 w-4" strokeWidth={1.75} /> Jump in as the employee
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Test the interviewer yourself: pick a character, read their brief, and take a
        live interview as them. Nothing said in a role-play enters your company records,
        and afterwards you get an observation debrief of how the interviewer performed.
      </p>
      {error && <p className="mt-2 text-xs text-ink-soft">{error}</p>}

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {cast.map((c) => (
          <div key={c.key} className="card-hairline flex flex-col rounded-card border border-line bg-surface p-4">
            <div className="font-medium text-ink">{c.role}</div>
            <div className="mt-0.5 text-xs text-ink-soft">{c.style}</div>
            <div className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-faint">Tests: {c.tests}</div>
            <button
              onClick={() => play(c)}
              disabled={busyKey !== null}
              className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-sunken disabled:opacity-50"
            >
              <Drama className="h-3.5 w-3.5" strokeWidth={1.75} />
              {busyKey === c.key ? "Preparing…" : "Play this character"}
            </button>
          </div>
        ))}
      </div>

      {runs.length > 0 && (
        <div className="card-hairline mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {runs.map((r) => {
            const member = r.persona_key ? castByKey.get(r.persona_key) : undefined;
            return (
              <div key={r.session_id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-ink">
                    {member?.role ?? "Role-play"}
                    <span className="font-normal text-ink-faint">
                      {" "}· {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {r.turns} turns
                    </span>
                  </div>
                  {!r.debrief && (
                    <button
                      onClick={() => debrief(r.session_id)}
                      disabled={pendingDebrief === r.session_id || r.turns < 4}
                      title={r.turns < 4 ? "Take the interview first; this run is too short to judge" : undefined}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-sunken disabled:opacity-50"
                    >
                      <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {pendingDebrief === r.session_id ? "Observing…" : "Get the debrief"}
                    </button>
                  )}
                </div>

                {r.debrief && (
                  <div className="mt-3">
                    <p className="max-w-2xl text-sm leading-relaxed text-ink">{r.debrief.headline}</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold text-ink-faint">What the interviewer did well</div>
                        {r.debrief.did_well.map((d, i) => (
                          <p key={i} className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                            {d.point}
                            <span className="block text-ink-faint">&ldquo;{d.evidence}&rdquo;</span>
                          </p>
                        ))}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ink-faint">What it missed</div>
                        {r.debrief.missed.length === 0 ? (
                          <p className="mt-1.5 text-xs text-ink-faint">Nothing major flagged.</p>
                        ) : (
                          r.debrief.missed.map((d, i) => (
                            <p key={i} className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                              {d.point}
                              <span className="block text-ink-faint">&ldquo;{d.evidence}&rdquo;</span>
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {r.debrief.objectives.map((o, i) => {
                        const Icon =
                          o.outcome === "earned" ? Check : o.outcome === "partial" ? Minus : CircleDashed;
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={1.75} />
                            <span className="text-ink-soft">
                              <span className="font-medium text-ink">{o.objective}</span>
                              {" "}({o.outcome.replace("_", " ")}): {o.note}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Playing-brief dialog */}
      <AnimatePresence>
        {briefFor && (
          <motion.div
            variants={scrimFade} initial="hidden" animate="show" exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-6 backdrop-blur-[2px]"
            onClick={() => setBriefFor(null)}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              transition={drawerSpring}
              className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card border border-line bg-surface p-6 shadow-elev-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl text-ink">Your character: {briefFor.role}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    Read the brief, then open the interview room and answer AS this
                    person: what they volunteer, what they hold back, how they talk.
                    Come back here afterwards for the debrief.
                  </p>
                </div>
                <button
                  onClick={() => setBriefFor(null)}
                  className="rounded-full p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-surface-sunken/50 p-4 text-xs leading-relaxed text-ink-soft whitespace-pre-wrap">
                {brief}
              </div>
              {invitePath && (
                <a
                  href={invitePath}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  Open the interview room
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
