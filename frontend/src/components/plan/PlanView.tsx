"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  NotebookPen,
  ListChecks,
  CircleCheck,
  Lock,
  Info,
  Clock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  SendHorizontal,
  PencilLine,
  ArrowLeft,
  FileText,
  Ban,
  BellRing,
  AlertTriangle,
  PauseCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import type {
  ClaimTopic,
  InterviewPlan,
  PlanCheckFlag,
  PlanState,
  SuggestedQuestion,
  Workspace,
} from "@/lib/types";
import brand from "@/lib/brand";
import { transition_plan, refine_plan, redraft_plan } from "@/lib/live";
import { PlanStateChip, MustHitDot, DiscoveryTag, BrandMark } from "@/components";
import { cn } from "@/lib/cn";
import { StageRail } from "../interviews/StageRail";
import { SendInterviewFlow } from "./SendInterviewFlow";

// The tracker ends at a single terminal node "Completed" (YC-AUDIT #13): COMPILED is the
// same milestone to the user (records compiled behind the scenes), so it sits on the
// COMPLETED node rather than adding a second near-identical "Compiled" step.
const TRACK: PlanState[] = ["SENT", "OPENED", "IN_PROGRESS", "COMPLETED"];
const TRACK_LABEL: Record<string, string> = {
  SENT: "Sent",
  OPENED: "Opened",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

// Suggested questions carry the generator's real per-question `topic` (a ClaimTopic — the
// same taxonomy the records use), so grouping them is HONEST, never a fabricated mapping
// (K1 acceptance). These are the human-readable group headers; an untagged question falls
// into a general bucket. When the plan carries only one topic (or none), the view renders a
// single "Suggested questions" group rather than an invented subdivision.
const QUESTION_GROUP_LABEL: Record<ClaimTopic, string> = {
  process_step: "Process & steps",
  pain: "Pain points & friction",
  person: "People & handoffs",
  tool: "Tools & systems",
  vocabulary: "Terms & vocabulary",
  time_or_cost: "Time & cost",
  company_fact: "Company facts",
  success_criteria: "Outcomes & success",
};

const GENERAL_KEY = "_general";

function groupQuestions(
  questions: SuggestedQuestion[],
): { key: string; label: string; questions: SuggestedQuestion[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, SuggestedQuestion[]>();
  for (const q of questions) {
    const key = q.topic ?? GENERAL_KEY;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(q);
  }
  return order.map((key) => ({
    key,
    label:
      key === GENERAL_KEY
        ? "More questions"
        : QUESTION_GROUP_LABEL[key as ClaimTopic] ?? "More questions",
    questions: buckets.get(key)!,
  }));
}

export function PlanView({
  workspace,
  plan,
  reportSessionId,
}: {
  workspace: Workspace;
  plan: InterviewPlan;
  reportSessionId?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PlanState>(plan.state);
  const [flowOpen, setFlowOpen] = useState(false);
  const [pending, setPending] = useState<PlanState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLive = TRACK.includes(state);
  // COMPILED is terminal but sits on the COMPLETED node, so the tracker still shows.
  const showTracker = isLive || state === "PAUSED" || state === "COMPILED";
  // Premium audit P0-1: Approve renders ONLY where APPROVED is a legal transition
  // (AWAITING_APPROVAL). NEXUS_CHECK shows the live checking state (the check is a real
  // job now); DRAFT shows redraft affordances. The old always-on button 409'd.
  const canApprove = state === "AWAITING_APPROVAL";
  const checking = state === "NEXUS_CHECK";
  const missionEmpty = !plan.mission.goal?.trim() && plan.mission.topics.length === 0;
  const isDraft = state === "DRAFT";
  // The most recent NEXUS_CHECK return, if any: a returned draft must show WHY it came
  // back (July 8 bug-hunt — the flags were stored in change_log but never rendered, so
  // the admin saw a flagged question sitting in the plan with no explanation).
  const checkFlags: PlanCheckFlag[] = (() => {
    for (let i = plan.change_log.length - 1; i >= 0; i--) {
      const entry = plan.change_log[i];
      if (entry?.actor === "nexus_check" && Array.isArray(entry.flags) && entry.flags.length > 0) {
        return entry.flags;
      }
    }
    return [];
  })();
  const [redrafting, setRedrafting] = useState(false);

  // While the check runs (or an empty draft generates), the state flips server-side in
  // seconds — poll a refresh so the admin never has to reload to see it unlock.
  useEffect(() => {
    if (!checking && !(isDraft && missionEmpty)) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [checking, isDraft, missionEmpty, router]);

  async function redraft() {
    if (redrafting) return;
    setRedrafting(true);
    setError(null);
    try {
      await redraft_plan(plan.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redraft failed");
    } finally {
      setRedrafting(false);
    }
  }
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
  const displayName = plan.interviewee_name ?? "this person";

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 pb-40 pt-8 sm:px-8">
        {/* Breadcrumb-style return (image21): the hub, then this person. */}
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-faint">
          <Link
            href={`/w/${workspace.slug}/interviews`}
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> All interviews
          </Link>
          <span className="text-line-strong">›</span>
          <span className="text-ink-soft">
            {plan.interviewee_name ?? "Unassigned"}
            {plan.interviewee_role && `, ${plan.interviewee_role}`}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Interview Plan</h1>
            <p className="mt-1.5 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
              This is the interview mission for {displayName}. Review and refine it before
              sending.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
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

        {/* The interview as one connected workflow: this is the Plan stage; Observe/Report
            link once the interview has run (Follow-up arrives with the report). */}
        <StageRail
          current="plan"
          className="mt-5"
          hrefs={
            reportSessionId
              ? {
                  observe: `/w/${workspace.slug}/interviews/${reportSessionId}`,
                  report: `/w/${workspace.slug}/report/${reportSessionId}`,
                }
              : {}
          }
        />

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
              Non-response simply ages here, no decline. Declines happen offline and are
              visible to the {brand.product_name} team only.
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

        {/* Two calm columns (image21). Left owns the mission as collapsible sections; right
            owns Refine + the grouped question list. Both columns share consistent widths at
            every viewport — the 254px/530px/1088px mix (audit finding 3) is gone. */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Left: the mission, one calm section at a time ─────────── */}
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Company
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-display text-sm text-ink">
                  {workspace.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{workspace.name}</div>
                  {cfg.tagline && (
                    <div className="truncate text-xs text-ink-faint">{cfg.tagline}</div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised font-medium text-ink-soft">
                  {(plan.interviewee_name ?? "?").charAt(0)}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
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

            {plan.mission.records_thin && (
              <div className="card-hairline flex items-start gap-2.5 rounded-card border border-line bg-surface-sunken p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                <div className="text-sm text-ink-soft">
                  <span className="font-medium text-ink">
                    Nexus knows very little about {plan.interviewee_name ?? "this person"} yet.
                  </span>{" "}
                  This plan is built from their role, not from records about them. The chat on
                  the right is the fastest way to tell Nexus more before you approve.
                </div>
              </div>
            )}

            <CollapsibleSection n={1} icon={Target} title="Goal">
              <p className="text-sm leading-relaxed text-ink-soft">{plan.mission.goal}</p>
              {plan.mission.custom_focus && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Your focus, as you described it: &ldquo;{plan.mission.custom_focus}&rdquo;
                </p>
              )}
            </CollapsibleSection>

            {plan.mission.known_context.length > 0 && (
              <CollapsibleSection n={2} icon={NotebookPen} title="Known context">
                <div className="flex flex-wrap gap-1.5">
                  {plan.mission.known_context.map((k, i) => (
                    <span
                      key={i}
                      className="rounded-chip border border-line bg-surface-sunken px-2.5 py-1 text-xs text-ink-soft"
                    >
                      {k}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-ink-faint">
                  <Lock className="h-3 w-3" strokeWidth={1.75} />
                  visible to you only, never shared with the interviewee
                </p>
              </CollapsibleSection>
            )}

            {mustHit.length + niceToHave.length > 0 && (
              <CollapsibleSection n={3} icon={ListChecks} title="Topics to cover">
                <div className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
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
              </CollapsibleSection>
            )}

            {plan.mission.definition_of_done.length > 0 && (
              <CollapsibleSection n={4} icon={CircleCheck} title="Definition of done">
                <ul className="space-y-2">
                  {plan.mission.definition_of_done.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2} />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {plan.mission.handling_notes.length > 0 && (
              <CollapsibleSection n={5} icon={Lock} title="Handling notes">
                <ul className="space-y-1.5">
                  {plan.mission.handling_notes.map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs text-ink-faint">
                  from the discovery call, unverified
                </p>
              </CollapsibleSection>
            )}
          </div>

          {/* ── Right: refine + grouped questions ─────────────────────── */}
          <div className="space-y-4">
            <RefinePlan plan={plan} />

            {plan.plan_changes && plan.plan_changes.length > 0 && (
              <section className="rounded-card border border-line bg-surface p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg text-ink">Plan changes</h3>
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

            <SuggestedQuestions questions={plan.suggested_questions} />
          </div>
        </div>

        {/* What the check flagged — rendered on a returned draft so the reasons travel
            with the plan instead of dying in the audit log. Severity order as stored. */}
        {isDraft && !missionEmpty && checkFlags.length > 0 && (
          <section className="mt-6 rounded-card border border-accent/25 bg-accent-soft/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-accent-ink">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              What the check flagged
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {brand.product_name} reviewed this draft and sent it back. Each item names the
              problem and a suggested fix — apply them with Refine plan above, or draft again.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {checkFlags.map((f, i) => (
                <li key={i} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.severity && (
                      <span
                        className={
                          "rounded-chip px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ring-1 ring-inset ring-ink/[0.04] " +
                          (f.severity === "fail"
                            ? "bg-danger-soft text-danger"
                            : f.severity === "fix"
                              ? "bg-pain-moderate text-tag-guess"
                              : "bg-surface-sunken text-ink-faint")
                        }
                      >
                        {f.severity}
                      </span>
                    )}
                    {f.kind && (
                      <span className="text-xs font-medium text-ink">{f.kind.replace(/-/g, " ")}</span>
                    )}
                    {f.where && <span className="text-xs text-ink-faint">· {f.where}</span>}
                  </div>
                  {f.issue && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.issue}</p>
                  )}
                  {f.proposed_fix && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                      <span className="font-medium text-ink-soft">Suggested fix:</span>{" "}
                      {f.proposed_fix}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

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
      </div>

      {/* ── Footer bar: est-time + the exact lifecycle action bar, restyled ───────── */}
      <div className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-4">
              <Link
                href={`/w/${workspace.slug}/interviews`}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken/40"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back
              </Link>
              {plan.est_time && (
                <div className="flex flex-col">
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                    <Clock className="h-4 w-4" strokeWidth={1.75} />
                    Est. time: {plan.est_time.total_min} min
                  </span>
                  <span className="mt-0.5 text-xs text-ink-faint">
                    {plan.est_time.opening_min} min opening · {plan.est_time.topics_min} min topics ·{" "}
                    {plan.est_time.closing_min} min closing
                  </span>
                </div>
              )}
            </div>

            {/* State action bar — EXACT lifecycle semantics preserved, restyled only. */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isRevoked || isNoResponse ? (
                <span className="text-sm text-ink-faint">
                  {isRevoked ? "This plan is closed." : "Awaiting a response."}
                </span>
              ) : (
                <>
                  {checking && (
                    <span className="inline-flex max-w-md items-center gap-2 text-sm text-ink-soft">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2} />
                      {brand.product_name} is checking this plan for leaks and leading
                      questions. It unlocks for your approval when the check lands.
                    </span>
                  )}
                  {isDraft && (
                    <span className="hidden max-w-xs text-xs leading-relaxed text-ink-faint sm:inline">
                      {missionEmpty
                        ? "Drafting didn't land (generation can be interrupted). Drafting runs the same pipeline and the same check."
                        : "Refine above and send it back for check — your edits travel with it. Draft again regenerates from the records."}
                    </span>
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
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" strokeWidth={1.75} />
                      {pending === "REVOKED" ? "Revoking…" : "Revoke"}
                    </button>
                  )}

                  {isDraft && !missionEmpty && (
                    // A refined returned draft can go BACK through the check carrying its
                    // refinements (bug-hunt #2: redraft regenerates and discards them).
                    <button
                      onClick={() => requestTransition("NEXUS_CHECK")}
                      disabled={pending != null || redrafting}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken/40 disabled:opacity-50"
                    >
                      {pending === "NEXUS_CHECK" ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      )}
                      Send back for check
                    </button>
                  )}
                  {isDraft && (
                    <button
                      onClick={redraft}
                      disabled={redrafting || pending != null}
                      className={
                        missionEmpty
                          ? "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:translate-y-0 disabled:opacity-50"
                          : "inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken/40 disabled:opacity-50"
                      }
                    >
                      {redrafting ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      ) : (
                        <PencilLine className="h-4 w-4" strokeWidth={2} />
                      )}
                      {missionEmpty ? "Draft the plan" : "Draft again"}
                    </button>
                  )}

                  {canApprove && (
                    <button
                      onClick={() => requestTransition("APPROVED")}
                      disabled={pending != null || missionEmpty}
                      title={
                        missionEmpty
                          ? "This plan hasn't drafted yet: no goal or topics to approve."
                          : undefined
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      {pending === "APPROVED" ? "Approving…" : "Approve plan"}
                    </button>
                  )}
                  {state === "APPROVED" && (
                    <button
                      onClick={() => setFlowOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
                    >
                      <SendHorizontal className="h-4 w-4" strokeWidth={2} />
                      Send interview
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <Lock className="h-3 w-3" strokeWidth={1.75} />
              {brand.product_name} will prepare the final review before anything reaches the person.
            </p>
            {plan.approved_by && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Approved by {plan.approved_by.name} · {plan.approved_by.at}
              </span>
            )}
          </div>
        </div>
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

// A calm mission section that opens and closes. Default open so nothing is hidden on
// arrival; the admin collapses what they've read. Numbered + icon-led to match image21.
function CollapsibleSection({
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
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-card px-5 py-4 text-left transition-colors hover:bg-surface-sunken/30"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-ink-faint">{n}</span>
          <span className="font-semibold text-ink">{title}</span>
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-ink-faint transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
        />
      </button>
      {open && <div className="px-5 pb-5 pl-16">{children}</div>}
    </section>
  );
}

// Suggested questions, grouped by the generator's real per-question topic (honest — see
// QUESTION_GROUP_LABEL). One-topic / untagged plans render a single group. Each group is an
// accordion with its own count; Expand all / Collapse all drive them together.
function SuggestedQuestions({ questions }: { questions: SuggestedQuestion[] }) {
  const groups = groupQuestions(questions);
  const multi = groups.length > 1;
  // Default: first group open, rest collapsed (image21). Single-group plans open it.
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(groups.slice(0, 1).map((g) => g.key)),
  );
  const allOpen = groups.every((g) => openKeys.has(g.key));

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <h3 className="font-display text-lg text-ink">Suggested questions</h3>
        </div>
        {multi && (
          <div className="flex items-center gap-3 text-xs font-medium text-accent-ink">
            <button
              onClick={() => setOpenKeys(new Set(groups.map((g) => g.key)))}
              disabled={allOpen}
              className="hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              Expand all
            </button>
            <span className="text-line-strong">|</span>
            <button
              onClick={() => setOpenKeys(new Set())}
              disabled={openKeys.size === 0}
              className="hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">
        {brand.product_name} will use these as a guide during the interview.
      </p>

      {questions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">
          Drafted at plan generation once objectives are set.
        </p>
      ) : multi ? (
        <ol className="mt-4 space-y-2.5">
          {groups.map((g, gi) => {
            const isOpen = openKeys.has(g.key);
            return (
              <li key={g.key} className="rounded-card border border-line bg-surface-sunken/25">
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 rounded-card px-4 py-3 text-left transition-colors hover:bg-surface-sunken/50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent">
                    {gi + 1}
                  </span>
                  <span className="font-medium text-ink">{g.label}</span>
                  <span className="ml-auto flex items-center gap-2.5">
                    <span className="rounded-chip border border-line bg-surface px-2 py-0.5 text-xs text-ink-faint">
                      {g.questions.length} question{g.questions.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-ink-faint transition-transform",
                        isOpen && "rotate-180",
                      )}
                      strokeWidth={1.75}
                    />
                  </span>
                </button>
                {isOpen && (
                  <ul className="space-y-2.5 px-4 pb-4 pl-[3.25rem]">
                    {g.questions.map((q, i) => (
                      <QuestionRow key={i} q={q} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <ul className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent">
                {i + 1}
              </span>
              <QuestionBody q={q} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionRow({ q }: { q: SuggestedQuestion }) {
  return (
    <li className="flex gap-2 text-sm text-ink">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <QuestionBody q={q} />
    </li>
  );
}

function QuestionBody({ q }: { q: SuggestedQuestion }) {
  return (
    <div className="min-w-0">
      <span className="text-sm text-ink">{q.text}</span>
      {q.reformulated_from && (
        <p className="mt-1 text-xs text-ink-faint">
          Reformulated from a leading question:{" "}
          <span className="italic">“{q.reformulated_from}”</span>
        </p>
      )}
    </div>
  );
}

// Refine Plan chat (A9 #6, wired live July 7 — Kaan P1-B): plain language into machine
// rules via /refine-chat. The backend applies only bounded safe edits and records every
// instruction, accepted or refused, to the plan's audited change_log. Replies below are
// the agent's real responses; applied edits re-render via router.refresh().
function RefinePlan({ plan }: { plan: InterviewPlan }) {
  const router = useRouter();
  type Msg = { role: "you" | "nexus"; at: string; text: string; author?: string };
  const [messages, setMessages] = useState<Msg[]>((plan.refine_chat ?? []) as Msg[]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { role: "you", at: now, text }]);
    setDraft("");
    setBusy(true);
    try {
      const r = await refine_plan(plan.id, text);
      const parts = [r.reply || (r.accepted ? "Done." : "I can't make that change.")];
      if (r.applied.length > 0)
        parts.push(`Applied ${r.applied.length} change${r.applied.length === 1 ? "" : "s"} to the plan (logged).`);
      if (r.rejected.length > 0)
        parts.push(`Refused ${r.rejected.length}: ${r.rejected.map((x) => x.reason).filter(Boolean).join("; ")}`);
      if (r.alternative) parts.push(`Alternative: ${r.alternative}`);
      setMessages((m) => [...m, { role: "nexus", at: now, text: parts.join(" ") }]);
      if (r.applied.length > 0) router.refresh();
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "nexus", at: now, text: e instanceof Error ? `That didn't go through: ${e.message}` : "That didn't go through. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-hairline flex flex-col rounded-card border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h3 className="font-display text-lg text-ink">Refine plan</h3>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">
        Add more detail for {brand.product_name} to improve the interview.
      </p>

      {messages.length > 0 && (
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-md border border-line bg-surface-sunken/30 p-3">
          {messages.map((m, i) =>
            m.role === "you" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent-soft px-3.5 py-2">
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
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-raised px-3.5 py-2">
                  <div className="mb-0.5 text-[11px] text-ink-faint">{brand.product_name} · {m.at}</div>
                  <p className="text-sm text-ink">{m.text}</p>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mt-3 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
          rows={2}
          placeholder={busy ? `${brand.product_name} is applying that…` : "e.g. add a question about how returns get approved"}
          className="min-h-[2.5rem] w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:cursor-wait"
        />
        <div className="mt-1 flex items-center justify-between">
          <Sparkles className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-surface text-accent-ink transition-colors enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-ink-faint"
            aria-label="Send refine instruction"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <SendHorizontal className="h-4 w-4" strokeWidth={2} />}
          </button>
        </div>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint">
        <Info className="h-3 w-3" strokeWidth={1.75} />
        Every change is logged in the change history.
      </p>
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
