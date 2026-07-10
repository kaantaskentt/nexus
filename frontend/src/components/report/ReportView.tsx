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
import { useEscapeClose } from "@/lib/useEscapeClose";
import { StepRail } from "@/components/StepRail";
import { StageRail } from "@/components/interviews/StageRail";
import { WorkflowStepCard, toolLabel } from "./WorkflowStepCard";
import { ArtifactsPanel } from "./ArtifactsPanel";

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
  // Follow-up composer (K5): the admin picks which open items become the focus of a new
  // follow-up interview. Default to all selected — the common case is "chase all of these."
  const [selectedFollowUps, setSelectedFollowUps] = useState<Set<number>>(
    () => new Set(report.follow_ups.map((_, i) => i)),
  );
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
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          {/* The label and destination agree (same class as Emre report #9): reports
              are listed on Interviews, so back goes there. */}
          <Link
            href={`/w/${workspace.slug}/interviews`}
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

        {/* The interview as one connected workflow — Report is lit; Plan and Observe link
            back to their stages (Follow-up becomes real via "Create follow-up interview"). */}
        <StageRail
          current="report"
          className="mt-5"
          hrefs={{
            ...(report.plan_id ? { plan: `/w/${workspace.slug}/plans/${report.plan_id}` } : {}),
            observe: `/w/${workspace.slug}/interviews/${sessionId}`,
          }}
        />

        {/* Findings first (K5): the takeaways lead; the workflow map is the evidence below. */}
        <section className="card-hairline mt-6 rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-ink">
            <Lightbulb className="h-5 w-5 text-accent" strokeWidth={1.75} />
            Key findings
          </h2>
          {report.key_findings.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Findings land here once the interview compiles.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
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
          )}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
          {/* ── Left: workflow canvas + perception gap ─────────────── */}
          <div className="min-w-0">
            <section className="card-hairline min-w-0 rounded-card border border-line bg-surface-raised p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl text-ink">{report.workflow_name}</h2>
                {workflowId && (
                  <Link
                    href={`/w/${workspace.slug}/workflow/${workflowId}?from=report:${sessionId}`}
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
                // Horizontal step rail — StepRail adds edge fades + chevrons driven by
                // real scroll state (Emre report #8: the fade alone read as a hard cut).
                <StepRail fadeFrom="from-surface-raised">
                  <div className="flex items-stretch gap-1">
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
                </StepRail>
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

          {/* ── Right: follow-ups / artifacts / quality ────────────── */}
          <aside className="space-y-6">
            <Panel icon={UserPlus} title="Open questions">
              {report.follow_ups.length === 0 ? (
                <p className="text-sm text-ink-soft">No open questions flagged.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-relaxed text-ink-faint">
                    Pick the open items to chase, then compose them into a follow-up
                    interview. It drafts from the records and passes the same check before
                    anything reaches the person.
                  </p>
                  <ul className="space-y-2.5">
                    {(showAllFollowUps ? report.follow_ups : report.follow_ups.slice(0, 6)).map(
                      (f, i) => (
                        <li key={i}>
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={selectedFollowUps.has(i)}
                              onChange={() =>
                                setSelectedFollowUps((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-accent focus:ring-accent"
                            />
                            <span className="text-sm text-ink-soft">{f.text}</span>
                          </label>
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
                  {(() => {
                    const chosen = report.follow_ups
                      .filter((_, i) => selectedFollowUps.has(i))
                      .map((f) => f.text);
                    if (chosen.length === 0) {
                      return (
                        <button
                          disabled
                          className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-faint opacity-60"
                        >
                          <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                          Select items to follow up on
                        </button>
                      );
                    }
                    const query = new URLSearchParams({
                      name: report.interviewee_name ?? "",
                      role: report.interviewee_role ?? "",
                      focus: `Follow up on these open items from the last interview: ${chosen.join("; ")}`,
                    }).toString();
                    return (
                      <Link
                        href={`/w/${workspace.slug}/interviews/new?${query}`}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
                      >
                        <UserPlus className="h-4 w-4" strokeWidth={2} />
                        Create follow-up interview ({chosen.length})
                      </Link>
                    );
                  })()}
                </>
              )}
            </Panel>

            {/* Promised materials (Kaan F1): promised-vs-delivered + copyable reminder. */}
            <ArtifactsPanel workspaceId={workspace.id} sessionId={sessionId} />

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

        {/* Bottom action bar — both wired to the real features (Emre report #4): SOP
            deep-opens the workflow editor's working generator; the transcript opens the
            Observer view's verbatim record. SOP stays honestly disabled only until the
            workflow map has landed. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Action
            primary
            icon={FileText}
            label="Generate SOP"
            sub="Creates the standard operating procedure from the mapped steps, in the respondent's own vocabulary."
            href={
              workflowId
                ? `/w/${workspace.slug}/workflow/${workflowId}?panel=sop&from=report:${sessionId}`
                : undefined
            }
            soon={workflowId ? undefined : "Available as soon as the workflow map lands"}
          />
          <Action
            icon={MessageSquare}
            label="View full transcript"
            sub="Read the full conversation, verbatim, in the interview view."
            href={`/w/${workspace.slug}/interviews/${sessionId}`}
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
  href,
}: {
  icon: typeof FileText;
  label: string;
  sub: string;
  primary?: boolean;
  // When set (and no href), the action isn't available yet: it renders disabled with
  // this tooltip instead of being a decorative click target (every-button-works).
  soon?: string;
  // A wired action navigates to the real feature.
  href?: string;
}) {
  const disabled = !href;
  const className =
    "inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-all duration-150 ease-standard " +
    (disabled
      ? "cursor-not-allowed border border-line text-ink-faint opacity-70"
      : primary
        ? "bg-accent text-on-accent shadow-elev-1 hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
        : "border border-line-strong text-ink hover:bg-surface-raised");
  return (
    <div className="text-center">
      {href ? (
        <Link href={href} className={className}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
          {label}
        </Link>
      ) : (
        <button disabled title={soon} className={className}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
          {label}
        </button>
      )}
      {disabled && soon && (
        <div className="mt-2 inline-block rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-faint ring-1 ring-inset ring-ink/[0.04]">
          {soon}
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
  useEscapeClose(step !== null, onClose);
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
