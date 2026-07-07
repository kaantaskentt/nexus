"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Target,
  NotebookPen,
  ListChecks,
  CircleCheck,
  Lock,
  Info,
  Clock,
  CheckCircle2,
  Paperclip,
  SendHorizontal,
  PencilLine,
  ArrowLeft,
  FileText,
  Ban,
  BellRing,
  AlertTriangle,
  PauseCircle,
} from "lucide-react";
import type { InterviewPlan, PlanState, Workspace } from "@/lib/types";
import brand from "@/lib/brand";
import { transition_plan } from "@/lib/live";
import { PlanStateChip, MustHitDot, DiscoveryTag, BrandMark } from "@/components";
import { SendInterviewFlow } from "./SendInterviewFlow";

// The tracker ends at a single terminal node "Completed" (YC-AUDIT #13): COMPILED is the
// same milestone to the user (records compiled behind the scenes), so it sits on the
// COMPLETED node rather than adding a second near-identical "Compiled" step.
const TRACK: PlanState[] = ["SENT", "OPENED", "IN_PROGRESS", "COMPLETED"];
// States that imply the plan cleared approval (footer reads "Approved" even when the
// live plan carries no approved_by stamp).
const APPROVED_STATES = new Set<PlanState>([
  "APPROVED", "SENT", "OPENED", "IN_PROGRESS", "PAUSED", "COMPLETED", "COMPILED",
]);
const TRACK_LABEL: Record<string, string> = {
  SENT: "Sent",
  OPENED: "Opened",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export function PlanView({
  workspace,
  plan,
  reportSessionId,
}: {
  workspace: Workspace;
  plan: InterviewPlan;
  reportSessionId?: string;
}) {
  const [state, setState] = useState<PlanState>(plan.state);
  const [flowOpen, setFlowOpen] = useState(false);
  const [pending, setPending] = useState<PlanState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLive = TRACK.includes(state);
  // COMPILED is terminal but sits on the COMPLETED node, so the tracker still shows.
  const showTracker = isLive || state === "PAUSED" || state === "COMPILED";
  const preApproval = (["DRAFT", "NEXUS_CHECK", "AWAITING_APPROVAL"] as PlanState[]).includes(state);
  // Revoke is the admin-side counterpart to Send; legal only where the server allows it
  // (APPROVED / SENT / OPENED — see routers/plans.py TRANSITIONS).
  const canRevoke = (["APPROVED", "SENT", "OPENED"] as PlanState[]).includes(state);
  const isRevoked = state === "REVOKED";
  const isNoResponse = state === "NO_RESPONSE";

  // Every transition is server-validated; the UI only requests legal ones and surfaces
  // failures inline instead of swallowing them (audit: no silent 409s).
  async function requestTransition(to: PlanState) {
    if (pending) return;
    setPending(to);
    setError(null);
    try {
      await transition_plan(plan.id, to);
      setState(to);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Could not move the plan to ${to.toLowerCase()}.`,
      );
    } finally {
      setPending(null);
    }
  }

  function revoke() {
    if (window.confirm("Revoke this interview plan? The invite link stops working. This cannot be undone.")) {
      requestTransition("REVOKED");
    }
  }

  const mustHit = plan.mission.topics.filter((t) => t.must_hit);
  const niceToHave = plan.mission.topics.filter((t) => !t.must_hit);
  const cfg = workspace.config ?? {};

  return (
    <>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <Link
          href={`/w/${workspace.slug}/plans`}
          className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> All interview plans
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Interview Plan</h1>
          <div className="flex items-center gap-3">
            {reportSessionId && (
              <Link
                href={`/w/${workspace.slug}/report/${reportSessionId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-soft"
              >
                <FileText className="h-4 w-4" strokeWidth={1.75} />
                View report
              </Link>
            )}
            <PlanStateChip state={state} />
          </div>
        </div>

        {showTracker && (
          <div className="card-hairline mt-5 rounded-card border border-line bg-surface p-4">
            <StatusTracker current={state} />
            {state === "PAUSED" && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-tag-guess">
                <PauseCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Paused by the respondent. It can resume or complete from here.
              </p>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              Non-response ages here with one gentle reminder, no decline. Declines happen
              offline and are visible to the {brand.product_name} team only.
            </p>
          </div>
        )}

        {isNoResponse && (
          <div className="card-hairline mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-strong bg-surface-sunken p-4">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
              <div className="text-sm text-ink-soft">
                <span className="font-medium text-ink">No response yet.</span> You can send one
                gentle reminder. There is no decline, and no second nudge.
              </div>
            </div>
            <button
              onClick={() => requestTransition("SENT")}
              disabled={pending != null}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:opacity-50"
            >
              <BellRing className="h-4 w-4" strokeWidth={1.75} />
              {pending === "SENT" ? "Sending…" : "Send gentle reminder"}
            </button>
          </div>
        )}

        {isRevoked && (
          <div className="card-hairline mt-5 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-soft p-4">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />
            <div className="text-sm text-ink-soft">
              <span className="font-medium text-danger">Plan revoked.</span> The invite link no
              longer works and this plan is closed. Start a new plan to interview this person.
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Interview Mission ─────────────────────────────────────── */}
          <section className="rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 className="font-display text-xl text-ink">Interview Mission</h2>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Company
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line font-display text-sm text-ink">
                  {workspace.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                </div>
                <div>
                  <div className="font-medium text-ink">{workspace.name}</div>
                  {cfg.tagline && (
                    <div className="text-xs text-ink-faint">{cfg.tagline}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Target Interviewee
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised font-medium text-ink-soft">
                  {(plan.interviewee_name ?? "?").charAt(0)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">
                    {plan.interviewee_name}
                    {plan.interviewee_role && (
                      <span className="text-ink-soft">, {plan.interviewee_role}</span>
                    )}
                  </span>
                  {plan.interviewee_tag && (
                    <DiscoveryTag label={plan.interviewee_tag.label} tone={plan.interviewee_tag.tone} />
                  )}
                  {plan.interviewee_note && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-ink-faint"
                      title={plan.interviewee_note}
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <MissionItem n={1} icon={Target} title="Goal">
                <p className="text-sm leading-relaxed text-ink-soft">{plan.mission.goal}</p>
              </MissionItem>

              <MissionItem n={2} icon={NotebookPen} title="Known Context">
                <ul className="space-y-1">
                  {plan.mission.known_context.map((k, i) => (
                    <li key={i} className="text-sm text-ink-soft">{k}</li>
                  ))}
                </ul>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint">
                  <Paperclip className="h-3 w-3" strokeWidth={1.75} />
                  visible to you only, never shared with the interviewee
                </p>
              </MissionItem>

              <MissionItem n={3} icon={ListChecks} title="Topics to Cover">
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent-ink">
                  Must-hit
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {mustHit.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink">
                      <MustHitDot mustHit className="mt-1" />
                      <span>{t.label}</span>
                    </li>
                  ))}
                </ul>
                {niceToHave.length > 0 && (
                  <>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Nice-to-have
                    </div>
                    <ul className="mt-1.5 space-y-1.5">
                      {niceToHave.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                          <MustHitDot mustHit={false} className="mt-1" />
                          <span>{t.label}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </MissionItem>

              <MissionItem n={4} icon={CircleCheck} title="Definition of Done">
                <ul className="space-y-1">
                  {plan.mission.definition_of_done.map((d, i) => (
                    <li key={i} className="text-sm text-ink-soft">{d}</li>
                  ))}
                </ul>
              </MissionItem>

              {plan.mission.handling_notes.length > 0 && (
                <MissionItem n={5} icon={Lock} title="Handling Notes">
                  <ul className="space-y-1">
                    {plan.mission.handling_notes.map((h, i) => (
                      <li key={i} className="text-sm text-ink-soft">{h}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-faint">
                    from the discovery call, unverified
                  </p>
                </MissionItem>
              )}
            </div>

            {/* Footer: approval + est time */}
            <div className="mt-6 rounded-card border border-line bg-surface-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {plan.approved_by ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    Approved by {plan.approved_by.name} · {plan.approved_by.at}
                  </span>
                ) : APPROVED_STATES.has(state) ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    Approved
                  </span>
                ) : (
                  <span className="text-sm text-ink-faint">Not yet approved</span>
                )}
                {plan.est_time && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                    <Clock className="h-4 w-4" strokeWidth={1.75} />
                    Est. time: {plan.est_time.total_min} min
                  </span>
                )}
              </div>
              {plan.est_time && (
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-faint">
                  <span>{plan.est_time.opening_min} min opening</span>
                  <span className="text-line-strong">·</span>
                  <span>{plan.est_time.topics_min} min topics</span>
                  <span className="text-line-strong">·</span>
                  <span>{plan.est_time.closing_min} min closing</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Refine Plan + Suggested Questions ─────────────────────── */}
          <div className="flex flex-col gap-6">
            <RefinePlan plan={plan} />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {plan.plan_changes && plan.plan_changes.length > 0 && (
                <section className="rounded-card border border-line bg-surface p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg text-ink">Plan Changes</h3>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {plan.plan_changes.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm text-ink-soft">
                        <span className="text-ink-faint">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-card border border-line bg-surface p-5 shadow-card">
                <h3 className="mb-3 font-display text-lg text-ink">Suggested Questions</h3>
                <ol className="space-y-3">
                  {plan.suggested_questions.length === 0 && (
                    <li className="text-sm text-ink-faint">
                      Drafted at plan generation once objectives are set.
                    </li>
                  )}
                  {plan.suggested_questions.map((q, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-ink">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent">
                        {i + 1}
                      </span>
                      <div>
                        <span>{q.text}</span>
                        {q.reformulated_from && (
                          <p className="mt-1 text-xs text-ink-faint">
                            Reformulated from a leading question:{" "}
                            <span className="italic">“{q.reformulated_from}”</span>
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </div>

        {/* Inline failure surface (audit: approve/send/revoke never fail silently) */}
        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Bottom action bar. Actions follow the server's lifecycle: approve a pending
            plan, then send it; revoke where legal (APPROVED/SENT/OPENED); once live it's
            read-only here. NO_RESPONSE and REVOKED carry their own banners above. */}
        {!isRevoked && !isNoResponse && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {preApproval && (
              <button
                onClick={() => requestTransition("APPROVED")}
                disabled={pending != null}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:translate-y-0 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                {pending === "APPROVED" ? "Approving…" : "Approve plan"}
              </button>
            )}

            {state === "APPROVED" && (
              <button
                onClick={() => setFlowOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
              >
                <SendHorizontal className="h-4 w-4" strokeWidth={2} />
                Send Interview
              </button>
            )}

            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2} />
                Interview sent. Tracking progress above.
              </span>
            )}

            {canRevoke && (
              <button
                onClick={revoke}
                disabled={pending != null}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/40 px-5 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
              >
                <Ban className="h-4 w-4" strokeWidth={1.75} />
                {pending === "REVOKED" ? "Revoking…" : "Revoke"}
              </button>
            )}

            <button
              disabled
              title="Follow-up templates arrive with the report and SOP tools in this build"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line px-5 py-3 text-sm font-medium text-ink-faint opacity-60"
            >
              <PencilLine className="h-4 w-4" strokeWidth={1.75} />
              Generate Follow-Up Template
            </button>
          </div>
        )}
      </div>

      <SendInterviewFlow
        open={flowOpen}
        plan={plan}
        workspace={workspace}
        onClose={() => setFlowOpen(false)}
        onSent={() => setState("SENT")}
      />
    </>
  );
}

function MissionItem({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-ink-faint">{n}</span>
          <h4 className="font-semibold text-ink">{title}</h4>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

// Refine Plan chat (A9 #6): plain language into machine rules with an audited change
// log. The composer is honestly disabled until the backend refine endpoint lands (it is
// being scoped) — no fabricated replies (no-mock-in-conversation). Any seeded transcript
// is real plan data and still renders.
function RefinePlan({ plan }: { plan: InterviewPlan }) {
  const messages = plan.refine_chat ?? [];

  return (
    <section className="card-hairline flex min-h-[22rem] flex-col rounded-card border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-ink">Refine Plan</h3>
        <span className="rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-faint ring-1 ring-inset ring-ink/[0.04]">
          Coming in this build
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-ink-faint">
            Ask {brand.product_name} to adjust an objective, add a topic, or reword a question
            in plain language. Every change compiles into the plan with an audited change log.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "you" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-accent-soft px-3.5 py-2">
                <div className="mb-0.5 flex items-center justify-end gap-1.5 text-[11px] text-ink-faint">
                  You · {m.at}
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[8px] font-semibold text-on-accent">
                    {m.author ?? "ES"}
                  </span>
                </div>
                <p className="text-sm text-ink">{m.text}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <BrandMark className="mt-1 h-4 w-4 shrink-0 text-accent" />
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-surface-raised px-3.5 py-2">
                <div className="mb-0.5 text-[11px] text-ink-faint">{brand.product_name} · {m.at}</div>
                <p className="text-sm text-ink">{m.text}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2 opacity-70">
        <Paperclip className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
        <input
          disabled
          placeholder={`Refine-with-${brand.product_name} lands with the chat agent`}
          title="The refine endpoint is being wired in this build"
          className="min-w-0 flex-1 cursor-not-allowed bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          disabled
          className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md bg-surface text-ink-faint"
          aria-label="Send (coming in this build)"
          title="The refine endpoint is being wired in this build"
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

function StatusTracker({ current }: { current: PlanState }) {
  // PAUSED sits on the IN_PROGRESS node (a hold within an in-progress interview); COMPILED
  // sits on the terminal COMPLETED node (same milestone to the user — YC-AUDIT #13).
  const positional =
    current === "PAUSED" ? "IN_PROGRESS" : current === "COMPILED" ? "COMPLETED" : current;
  const currentIdx = TRACK.indexOf(positional);
  return (
    <div className="flex items-center">
      {TRACK.map((s, i) => {
        const done = i <= currentIdx;
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span className={"h-3 w-3 rounded-full " + (done ? "bg-accent" : "bg-line-strong")} />
              <span
                className={
                  "text-[11px] font-medium " +
                  (i === currentIdx ? "text-accent-ink" : "text-ink-faint")
                }
              >
                {TRACK_LABEL[s]}
              </span>
            </div>
            {i < TRACK.length - 1 && (
              <div className={"mx-2 mb-4 h-0.5 flex-1 " + (i < currentIdx ? "bg-accent" : "bg-line")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
