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
  Save,
  PencilLine,
  ArrowLeft,
} from "lucide-react";
import type { InterviewPlan, PlanState, Workspace } from "@/lib/types";
import { AppShell, PlanStateChip, MustHitDot, DiscoveryTag, BrandMark } from "@/components";
import { SendInterviewFlow } from "./SendInterviewFlow";

const TRACK: PlanState[] = ["SENT", "OPENED", "IN_PROGRESS", "COMPLETED", "COMPILED"];
const TRACK_LABEL: Record<string, string> = {
  SENT: "Sent",
  OPENED: "Opened",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  COMPILED: "Compiled",
};

export function PlanView({
  workspace,
  plan,
}: {
  workspace: Workspace;
  plan: InterviewPlan;
}) {
  const [state, setState] = useState<PlanState>(plan.state);
  const [flowOpen, setFlowOpen] = useState(false);
  const isLive = TRACK.includes(state);

  const mustHit = plan.mission.topics.filter((t) => t.must_hit);
  const niceToHave = plan.mission.topics.filter((t) => !t.must_hit);
  const cfg = workspace.config ?? {};

  return (
    <AppShell workspace={workspace} active="plans">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <Link
          href={`/w/${workspace.slug}/plans`}
          className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> All plans
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-4xl text-ink">Interview Plan</h1>
          <PlanStateChip state={state} />
        </div>

        {isLive && (
          <div className="mt-5 rounded-card border border-line bg-surface p-4">
            <StatusTracker current={state} />
            <p className="mt-3 text-xs text-ink-faint">
              Non-response ages here — one gentle reminder, no decline. Declines happen
              offline and are visible to the Nexus team only.
            </p>
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
                    {plan.interviewee_name} — {plan.interviewee_role}
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
                  visible to you only — never shared with the interviewee
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
                    from the discovery call — unverified
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

        {/* Bottom action bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            onClick={() => setFlowOpen(true)}
            disabled={isLive}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2} />
            {isLive ? "Interview sent" : "Send Interview"}
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-raised">
            <Save className="h-4 w-4" strokeWidth={1.75} />
            Save Plan
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-raised">
            <PencilLine className="h-4 w-4" strokeWidth={1.75} />
            Generate Follow-Up Template
          </button>
        </div>
      </div>

      <SendInterviewFlow
        open={flowOpen}
        plan={plan}
        workspace={workspace}
        onClose={() => setFlowOpen(false)}
        onSent={() => setState("SENT")}
      />
    </AppShell>
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

// Refine Plan chat (A9 #6): plain language → machine rules with an audited change log.
// The transcript is seeded from the plan; the input appends locally (a live demo of
// the loop — the real endpoint compiles each turn into rule changes).
function RefinePlan({ plan }: { plan: InterviewPlan }) {
  const [messages, setMessages] = useState(plan.refine_chat ?? []);
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: "you", at: "now", text, author: "ES" },
      { role: "nexus", at: "now", text: "Noted — folding that into the plan and the change log." },
    ]);
    setDraft("");
  }

  return (
    <section className="flex min-h-[22rem] flex-col rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg text-ink">Refine Plan</h3>
      <div className="flex-1 space-y-3 overflow-y-auto">
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
                <div className="mb-0.5 text-[11px] text-ink-faint">Nexus · {m.at}</div>
                <p className="text-sm text-ink">{m.text}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2">
        <Paperclip className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask Nexus to refine the plan…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          onClick={send}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent-ink transition-colors hover:bg-accent hover:text-on-accent"
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

function StatusTracker({ current }: { current: PlanState }) {
  const currentIdx = TRACK.indexOf(current);
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
