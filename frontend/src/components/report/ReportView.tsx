"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Zap,
  Loader2,
  Lightbulb,
  UserPlus,
  Star,
  FileText,
  CalendarDays,
  MessageSquare,
  X,
} from "lucide-react";
import type { Report, Workspace, WorkflowStep } from "@/lib/types";
import { AppShell, ConfidenceBadge } from "@/components";
import { WorkflowStepCard } from "./WorkflowStepCard";

export function ReportView({
  workspace,
  report,
}: {
  workspace: Workspace;
  report: Report;
}) {
  const [openStep, setOpenStep] = useState<WorkflowStep | null>(null);

  return (
    <AppShell workspace={workspace} active="plans">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/w/${workspace.slug}/plans`}
            className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to Interviews
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Visible to admins only
          </span>
        </div>

        <h1 className="mt-4 font-display text-4xl text-ink">Post-Interview Report</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span>{workspace.name}</span>
          {report.interviewee_name && (
            <>
              <span className="text-line-strong">·</span>
              <span>
                {report.interviewee_name}
                {report.interviewee_role ? ` — ${report.interviewee_role}` : ""}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-chip bg-success-soft px-2.5 py-1 text-xs font-medium text-tag-verified">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {report.status_label}
            {report.duration_min > 0 ? ` · ${report.duration_min} min` : ""}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
          {/* ── Left: workflow canvas + perception gap ─────────────── */}
          <div className="min-w-0">
            <section className="rounded-card border border-line bg-surface-raised p-5">
              <h2 className="mb-4 font-display text-xl text-ink">{report.workflow_name}</h2>
              {report.steps.length === 0 ? (
                <div className="flex items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-soft">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" strokeWidth={1.75} />
                  Mapping the workflow from the conversation — this lands a moment after
                  the findings.
                </div>
              ) : (
                <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
                  {report.steps.map((step, i) => (
                    <div key={step.index} className="flex items-start gap-1">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <WorkflowStepCard step={step} onClick={() => setOpenStep(step)} />
                      </motion.div>
                      {i < report.steps.length - 1 && (
                        <ArrowRight className="mt-16 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {report.perception_gap ? (
              <div className="mt-5 flex gap-4 rounded-card border border-accent bg-accent-soft p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Zap className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-semibold uppercase tracking-wide text-accent-ink">
                      Perception gap found:
                    </span>{" "}
                    <span className="text-ink">{report.perception_gap.estimate}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {report.perception_gap.actual} {report.perception_gap.driver}
                  </p>
                </div>
              </div>
            ) : (
              // A single interview legitimately has no gaps (they need a second voice).
              <div className="mt-5 rounded-card border border-line bg-surface p-4 text-sm text-ink-soft">
                No perception gaps yet — these surface once a second interview
                contradicts the founder&apos;s account.
              </div>
            )}
          </div>

          {/* ── Right: findings / follow-ups / quality ─────────────── */}
          <aside className="space-y-6">
            <Panel icon={Lightbulb} title="Key Findings">
              <ul className="space-y-3">
                {report.key_findings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>
                      {f.text}
                      {f.emphasis && (
                        <>
                          {" ("}
                          <span className="font-semibold text-danger">{f.emphasis}</span>
                          {")"}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={UserPlus} title="Follow Up On">
              <ul className="space-y-3">
                {report.follow_ups.map((f, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="text-sm text-ink-soft">{f.text}</span>
                    <button className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink">
                      Add to plan
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={Star} title="Interview Quality">
              {/* Show the objective count + bar only when objectives were scored;
                  otherwise the assessment is qualitative (a headline). */}
              {report.quality.objectives_total > 0 && (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-ink">
                      {report.quality.objectives_captured} / {report.quality.objectives_total} objectives captured
                    </span>
                    <span className="text-sm font-semibold text-ink-soft">{report.quality.percent}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div className="h-2 rounded-full bg-success" style={{ width: `${report.quality.percent}%` }} />
                  </div>
                </>
              )}
              {report.quality.partial_dodged > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {report.quality.partial_dodged} marked partial-dodged
                </p>
              )}
              {report.quality.note && (
                <p className="mt-3 rounded-card border border-line bg-surface p-3 text-sm leading-relaxed text-ink-soft">
                  {report.quality.note}
                </p>
              )}
            </Panel>
          </aside>
        </div>

        {/* Bottom action bar */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Action
            primary
            icon={FileText}
            label="Generate SOP"
            sub="Creates the standard operating procedure from verified steps, with the respondent's own words as evidence."
          />
          <Action
            icon={CalendarDays}
            label="Schedule next interview"
            sub="Find the right person to fill the gaps and strengthen this workflow."
          />
          <Action
            icon={MessageSquare}
            label="View full transcript"
            sub="Read the full conversation, including all answers and context."
          />
        </div>
      </div>

      <StepDetailDrawer
        step={openStep}
        total={report.steps.length}
        onClose={() => setOpenStep(null)}
      />
    </AppShell>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lightbulb;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-ink">
        <Icon className="h-[18px] w-[18px] text-accent" strokeWidth={1.75} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Action({
  icon: Icon,
  label,
  sub,
  primary,
}: {
  icon: typeof FileText;
  label: string;
  sub: string;
  primary?: boolean;
}) {
  return (
    <div className="text-center">
      <button
        className={
          "inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors " +
          (primary
            ? "bg-accent text-on-accent hover:opacity-90"
            : "border border-line-strong text-ink hover:bg-surface-raised")
        }
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        {label}
      </button>
      <p className="mx-auto mt-2 max-w-[16rem] text-xs text-ink-faint">{sub}</p>
    </div>
  );
}

// Step detail (stage8-step-detail): the compiled view of one step. The respondent's
// account is PARAPHRASED (F33/A3) — never a verbatim attributed employee quote.
function StepDetailDrawer({
  step,
  total,
  onClose,
}: {
  step: WorkflowStep | null;
  total: number;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {step && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l border-line bg-canvas p-6 shadow-card"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-ink-faint">Step {step.index} of {total}</div>
                <h2 className="mt-0.5 font-display text-2xl text-ink">{step.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1 text-ink-faint hover:bg-surface-raised hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            {step.description && (
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">{step.description}</p>
            )}

            <div className="space-y-3">
              <DetailBox label="Tool">{step.tool.name}</DetailBox>
              {step.action && <DetailBox label="Action">{step.action}</DetailBox>}
              {step.input && <DetailBox label="Input">{step.input}</DetailBox>}
              {step.output && <DetailBox label="Output">{step.output}</DetailBox>}
            </div>

            {step.captured_paraphrase && (
              <div className="mt-5">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Captured from {step.captured_from} · paraphrased
                </div>
                <div className="rounded-card border border-line bg-surface p-3 text-sm leading-relaxed text-ink-soft">
                  {step.captured_paraphrase}
                </div>
              </div>
            )}

            {step.confidence && (
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Confidence
                </span>
                <ConfidenceBadge confidence={step.confidence} />
              </div>
            )}

            {step.unverified_questions && step.unverified_questions.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-accent-ink">
                  Unverified / Need clarification
                </div>
                <ul className="space-y-2">
                  {step.unverified_questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-soft">
                      <span className="text-accent">+</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
                <button className="mt-4 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-raised">
                  Add follow-up question
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-faint">{label}</div>
      <div className="rounded-card border border-line bg-surface p-3 text-sm text-ink">{children}</div>
    </div>
  );
}
