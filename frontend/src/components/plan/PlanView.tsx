"use client";

import { useState } from "react";
import Link from "next/link";
import type { InterviewPlan, PlanState, Workspace } from "@/lib/types";
import { AppShell, MustHitDot, PlanStateChip } from "@/components";
import { SendInterviewFlow } from "./SendInterviewFlow";

// The live, post-send progression rendered as a stepper. DRAFT/review states and
// the exits (NO_RESPONSE / REVOKED) are shown by the chip, not the stepper.
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
  // The lifecycle state is the backend's to own; here we mirror it locally so the
  // Send flow can reflect an optimistic SENT while the real transition round-trips.
  const [state, setState] = useState<PlanState>(plan.state);
  const [flowOpen, setFlowOpen] = useState(false);

  const mustHit = plan.mission.topics.filter((t) => t.must_hit);
  const niceToHave = plan.mission.topics.filter((t) => !t.must_hit);
  const isLive = TRACK.includes(state);
  const preApproval = ["DRAFT", "NEXUS_CHECK", "AWAITING_APPROVAL"].includes(state);

  return (
    <AppShell workspace={workspace} active="plans">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <Link
          href={`/w/${workspace.slug}/plans`}
          className="text-sm text-ink-faint hover:text-ink"
        >
          ← All plans
        </Link>

        {/* Header */}
        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl text-ink">
                {plan.interviewee_name ?? "Unassigned"}
              </h1>
              <PlanStateChip state={state} />
            </div>
            <div className="mt-1 text-sm uppercase tracking-wide text-ink-faint">
              {plan.interviewee_role}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {state === "APPROVED" && (
              <button
                onClick={() => setFlowOpen(true)}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                Send Interview
              </button>
            )}
            {preApproval && (
              <span
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink-faint"
                title="A plan must be approved before it can be sent"
              >
                Awaiting approval
              </span>
            )}
          </div>
        </header>

        {/* Live status tracker — shown once the invite is out (A4) */}
        {isLive && (
          <div className="mt-6 rounded-card border border-line bg-surface p-5">
            <StatusTracker current={state} />
            <p className="mt-3 text-xs text-ink-faint">
              Non-response ages here — one gentle reminder, no decline. Declines happen
              offline and are visible to the Nexus team only.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
          {/* Mission */}
          <div className="min-w-0 space-y-8">
            <MissionBlock title="Goal">
              <p className="text-base leading-relaxed text-ink">{plan.mission.goal}</p>
            </MissionBlock>

            <MissionBlock title="Known Context" locked>
              <p className="mb-3 text-xs text-ink-faint">
                Locked. This orients the interviewer only — none of it is ever spoken to
                the interviewee as a statement.
              </p>
              <ul className="space-y-2">
                {plan.mission.known_context.map((k, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-ink-faint">•</span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </MissionBlock>

            <MissionBlock title="Topics">
              <div className="space-y-4">
                <div>
                  <div className="mb-2">
                    <MustHitDot mustHit withLabel />
                  </div>
                  <ul className="space-y-2">
                    {mustHit.map((t, i) => (
                      <TopicRow key={i} topic={t} />
                    ))}
                  </ul>
                </div>
                {niceToHave.length > 0 && (
                  <div>
                    <div className="mb-2">
                      <MustHitDot mustHit={false} withLabel />
                    </div>
                    <ul className="space-y-2">
                      {niceToHave.map((t, i) => (
                        <TopicRow key={i} topic={t} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </MissionBlock>

            <MissionBlock title="Definition of Done">
              <ul className="space-y-2">
                {plan.mission.definition_of_done.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-success">✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </MissionBlock>

            {plan.mission.handling_notes.length > 0 && (
              <MissionBlock title="Handling Notes">
                <ul className="space-y-2">
                  {plan.mission.handling_notes.map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-soft">
                      <span className="text-ink-faint">→</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </MissionBlock>
            )}
          </div>

          {/* Right rail: questions, never-list, change log */}
          <aside className="space-y-8">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Suggested Questions
              </h3>
              <ul className="space-y-3">
                {plan.suggested_questions.length === 0 && (
                  <li className="text-sm text-ink-faint">
                    Drafted at plan generation once objectives are set.
                  </li>
                )}
                {plan.suggested_questions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-card border border-line bg-surface p-3 text-sm leading-relaxed text-ink"
                  >
                    {q.text}
                    {q.reformulated_from && (
                      <p className="mt-2 border-t border-line pt-2 text-xs text-ink-faint">
                        Reformulated from a leading question:
                        <span className="italic"> “{q.reformulated_from}”</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-danger">
                Never
              </h3>
              <ul className="space-y-2 rounded-card border border-line bg-surface p-4">
                {plan.never_list.map((n, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-danger">✕</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                Hard rules override objectives. The interviewer receives these in the
                handoff package — never the underlying claim text.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Change Log
              </h3>
              <ol className="space-y-2 border-l border-line pl-3">
                {plan.change_log.map((c, i) => (
                  <li key={i} className="text-xs text-ink-soft">
                    <span className="font-medium text-ink">{c.actor}</span> — {c.change}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
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

function MissionBlock({
  title,
  locked,
  children,
}: {
  title: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-ink">
        {title}
        {locked && (
          <span className="rounded-chip border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Locked
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function TopicRow({ topic }: { topic: { label: string; detail?: string } }) {
  return (
    <li className="text-sm text-ink">
      <span className="font-medium">{topic.label}</span>
      {topic.detail && (
        <span className="block text-ink-soft">{topic.detail}</span>
      )}
    </li>
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
              <span
                className={
                  "h-3 w-3 rounded-full " + (done ? "bg-accent" : "bg-line-strong")
                }
              />
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
              <div
                className={
                  "mx-2 mb-4 h-0.5 flex-1 " + (i < currentIdx ? "bg-accent" : "bg-line")
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
