"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  GitCompareArrows,
  Loader2,
  Lightbulb,
  UserPlus,
  Star,
  FileText,
  MessageSquare,
  PenLine,
  X,
} from "lucide-react";
import type { Report, TrustTag, Workspace, WorkflowStep } from "@/lib/types";
import { get_workflow_by_session } from "@/lib/live";
import { ConfidenceBadge } from "@/components";
import { confidenceForTag } from "@/lib/trust";
import { conflictKindMeta } from "@/lib/conflicts";
import { scrimFade, drawerSpring } from "@/lib/variants";
import { WorkflowStepCard, toolLabel } from "./WorkflowStepCard";

export function ReportView({
  workspace,
  report,
  sessionId,
}: {
  workspace: Workspace;
  report: Report;
  sessionId: string;
}) {
  const [openStep, setOpenStep] = useState<WorkflowStep | null>(null);
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);
  // Resolve this report's workflow by its session so the header can link into the
  // editor. The base workflow only exists once the canvas has fanned out, so we resolve
  // lazily off the steps landing and leave the link out until there's a target.
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  useEffect(() => {
    if (report.steps.length === 0) return;
    let live = true;
    get_workflow_by_session(sessionId)
      .then((w) => {
        if (live) setWorkflowId(w.workflow_id);
      })
      .catch(() => {
        /* editor link stays hidden if the workflow can't be resolved */
      });
    return () => {
      live = false;
    };
  }, [sessionId, report.steps.length]);

  return (
    <>
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

        <h1 className="mt-4 font-display text-[2.75rem] leading-[1.05] text-ink">Post-Interview Report</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span>{workspace.name}</span>
          {report.interviewee_name && (
            <>
              <span className="text-line-strong">·</span>
              <span>
                {report.interviewee_name}
                {report.interviewee_role ? ` · ${report.interviewee_role}` : ""}
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
            <section className="card-hairline rounded-card border border-line bg-surface-raised p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl text-ink">{report.workflow_name}</h2>
                {workflowId && (
                  <Link
                    href={`/w/${workspace.slug}/workflow/${workflowId}`}
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    <PenLine className="h-4 w-4" strokeWidth={1.75} /> Open workflow editor
                  </Link>
                )}
              </div>
              {report.steps.length === 0 ? (
                <div className="flex items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-soft">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" strokeWidth={1.75} />
                  Mapping the workflow from the conversation. This lands a moment after
                  the findings.
                </div>
              ) : (
                // Horizontal step rail. The right-edge fade signals "scroll for more" so a
                // partially-visible card reads as a peek, not a hard cut (DESIGN-V2 §4.8).
                <div className="relative">
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
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-surface-raised to-transparent" />
                </div>
              )}
            </section>

            {report.conflicts.length > 0 ? (
              <div className="mt-5 space-y-3">
                <h2 className="font-display text-lg text-ink">Cross-Interview Conflicts</h2>
                {report.conflicts.map((c, i) => {
                  const meta = conflictKindMeta(c.kind);
                  return (
                    <div
                      key={i}
                      className="card-hairline rounded-card border border-accent/25 bg-accent-soft/60 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-accent-ink ring-1 ring-inset ring-accent/20">
                          <GitCompareArrows className="h-3.5 w-3.5" strokeWidth={2} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                        <ConflictSide side={c.a} />
                        <div className="flex items-center justify-center">
                          <span className="rounded-chip bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint shadow-elev-1">
                            vs
                          </span>
                        </div>
                        <ConflictSide side={c.b} />
                      </div>
                      {c.note && (
                        <p className="mt-3 border-t border-accent/15 pt-2.5 text-sm leading-relaxed text-ink-soft">
                          <span className="font-medium text-accent-ink">What differs: </span>
                          {c.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Genuinely no conflicts for this interview — honest only when the
              // conflict_points list (not the frequently-empty perception_gaps) is empty.
              <div className="card-hairline mt-5 rounded-card border border-line bg-surface p-4 text-sm text-ink-soft">
                No cross-interview conflicts from this interview yet. They surface when a
                record here disagrees with another interview.
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
                {(showAllFollowUps ? report.follow_ups : report.follow_ups.slice(0, 6)).map(
                  (f, i) => (
                    <li key={i} className="flex items-start justify-between gap-3">
                      <span className="text-sm text-ink-soft">{f.text}</span>
                      <button
                        disabled
                        title="Add-to-plan from a finding is being wired with the chat agent in this build"
                        className="shrink-0 cursor-not-allowed rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-faint opacity-60"
                      >
                        Add to plan
                      </button>
                    </li>
                  ),
                )}
              </ul>
              {report.follow_ups.length > 6 && (
                <button
                  onClick={() => setShowAllFollowUps((v) => !v)}
                  className="mt-3 text-xs font-medium text-accent hover:underline"
                >
                  {showAllFollowUps
                    ? "Show fewer"
                    : `Show ${report.follow_ups.length - 6} more`}
                </button>
              )}
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

        {/* Bottom action bar. SOP export ships with the workflow editor (#21); the
            transcript view opens the verbatim record. Both are disabled until wired
            (every-button-works: no decorative click targets). */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Action
            primary
            icon={FileText}
            label="Generate SOP"
            sub="Creates the standard operating procedure from verified steps, with the respondent's own words as evidence."
            soon="Generate SOP ships with the workflow editor in this build"
          />
          <Action
            icon={MessageSquare}
            label="View full transcript"
            sub="Read the full conversation, including all answers and context."
            soon="Transcript view ships in the next build"
          />
        </div>
      </div>

      <StepDetailDrawer
        step={openStep}
        total={report.steps.length}
        onClose={() => setOpenStep(null)}
      />
    </>
  );
}

// One side of a report conflict: the record text plus its trust badge. No speaker line
// here (the report conflict feed carries text + tag, not who) — the kind label above
// names the axis; neither side is styled as the "right" one.
function ConflictSide({ side }: { side: { text: string; tag: TrustTag | null } }) {
  return (
    <div className="card-hairline flex flex-col rounded-md border border-line bg-surface p-3">
      {side.tag && (
        <div className="mb-1.5 flex justify-end">
          <ConfidenceBadge confidence={confidenceForTag(side.tag)} />
        </div>
      )}
      <p className="text-sm leading-relaxed text-ink-soft">{side.text}</p>
    </div>
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
    <section className="card-hairline rounded-card border border-line bg-surface p-5">
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
  soon,
}: {
  icon: typeof FileText;
  label: string;
  sub: string;
  primary?: boolean;
  // When set, the action isn't wired yet: it renders disabled with this tooltip and a
  // "Coming in this build" tag, instead of being a decorative click target.
  soon?: string;
}) {
  const disabled = Boolean(soon);
  return (
    <div className="text-center">
      <button
        disabled={disabled}
        title={soon}
        className={
          "inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-all duration-150 ease-standard " +
          (disabled
            ? "cursor-not-allowed border border-line text-ink-faint opacity-70"
            : primary
              ? "bg-accent text-on-accent shadow-elev-1 hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
              : "border border-line-strong text-ink hover:bg-surface-raised")
        }
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        {label}
      </button>
      {disabled && (
        <div className="mt-2 inline-block rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-faint ring-1 ring-inset ring-ink/[0.04]">
          Coming in this build
        </div>
      )}
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
            variants={scrimFade}
            initial="hidden"
            animate="show"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={drawerSpring}
            className="glass fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l p-6 shadow-elev-3"
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
              <DetailBox label="Tool">{toolLabel(step.tool.name)}</DetailBox>
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
                <button
                  disabled
                  title="Editing the workflow map arrives with the workflow editor in this build"
                  className="mt-4 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-faint opacity-60"
                >
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
