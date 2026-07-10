"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, MessageSquare, Users, Eye, Plus, Trash2, FileText, ClipboardList } from "lucide-react";
import type { InterviewPlan, PlanState, Workspace } from "@/lib/types";
import type { SessionSummary } from "@/lib/live";
import { rise, staggerParent } from "@/lib/variants";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { PlanStateChip } from "@/components";
import { DeleteInterviewDialog } from "./DeleteInterviewDialog";
import { StageDots, stageLabel, type Stage } from "./StageRail";

// Interview status → a calm pill. These are the interview_sessions states (F: pending →
// active → completed, plus paused/expired), not the 12 plan states — a session is only
// "completed" once the respondent finished and it compiled.
const STATUS: Record<string, { label: string; pill: string }> = {
  completed: { label: "Completed", pill: "bg-success-soft text-tag-confirmed" },
  active: { label: "In progress", pill: "bg-accent-soft text-accent-ink" },
  paused: { label: "Paused", pill: "bg-pain-moderate text-tag-guess" },
  pending: { label: "Not started", pill: "bg-surface-sunken text-ink-soft" },
  expired: { label: "Expired", pill: "bg-surface-sunken text-ink-faint" },
};

// A plan still being shaped (no interview sent yet) shows as a Plan-stage card. Once a plan
// is SENT its interview lives as a session (run card), so these are the only states that
// surface a separate plan card — the /plans list and /interviews list stop double-listing
// the same person (audit finding 2). Deep links /plans/[id] keep working.
const PLANNING_STATES = new Set<PlanState>(["DRAFT", "NEXUS_CHECK", "AWAITING_APPROVAL", "APPROVED"]);


// One merged, staged hub item — either an interview run (a session) or an interview still
// in planning (a pre-send plan). Sorted so what needs the human sits at the top.
type HubItem =
  | {
      kind: "run";
      key: string;
      name: string;
      role?: string;
      modality: "text" | "voice";
      status: string;
      sessionId: string;
      hasReport: boolean;
      planId?: string;
      stage: Stage;
      rank: number;
    }
  | {
      kind: "plan";
      key: string;
      name: string;
      role?: string;
      planId: string;
      state: PlanState;
      goal?: string;
      stage: Stage;
      rank: number;
    };

function runStage(s: SessionSummary): Stage {
  return s.has_report ? "report" : "observe";
}

function runRank(s: SessionSummary): number {
  if (s.status === "active") return 1;
  if (s.status === "pending" || s.status === "paused") return 2;
  return 5; // completed / other
}

function planRank(state: PlanState): number {
  if (state === "AWAITING_APPROVAL") return 0; // waiting on a human approval
  return 3;
}

function buildHubItems(sessions: SessionSummary[], plans: InterviewPlan[]): HubItem[] {
  // Most recent plan per person, used to link a run card back to its Plan stage.
  const latestPlanByName = new Map<string, InterviewPlan>();
  for (const p of plans) {
    const n = p.interviewee_name?.toLowerCase();
    if (!n) continue;
    if (!latestPlanByName.has(n)) latestPlanByName.set(n, p); // list_plans is newest-first
  }

  const runs: HubItem[] = sessions.map((s) => {
    const name = s.interviewee_name ?? "Interviewee";
    return {
      kind: "run",
      key: `run-${s.id}`,
      name,
      role: s.interviewee_role ?? undefined,
      modality: s.modality,
      status: s.status,
      sessionId: s.id,
      hasReport: s.has_report,
      planId: latestPlanByName.get(name.toLowerCase())?.id,
      stage: runStage(s),
      rank: runRank(s),
    };
  });

  const planCards: HubItem[] = plans
    .filter((p) => PLANNING_STATES.has(p.state))
    .map((p) => ({
      kind: "plan" as const,
      key: `plan-${p.id}`,
      name: p.interviewee_name ?? "Unassigned",
      role: p.interviewee_role ?? undefined,
      planId: p.id,
      state: p.state,
      goal: p.mission?.goal?.trim() || undefined,
      stage: "plan" as Stage,
      rank: planRank(p.state),
    }));

  return [...planCards, ...runs].sort((a, b) => a.rank - b.rank);
}

export function InterviewsView({
  workspace,
  sessions,
  plans,
}: {
  workspace: Workspace;
  sessions: SessionSummary[];
  plans: InterviewPlan[];
}) {
  // Expired links are noise for a returning admin (premium audit P1-5): kept out of the
  // list, honestly counted below it. Nothing is deleted; an expired session with a report
  // would still show (reports never expire).
  const [showExpired, setShowExpired] = useState(false);
  const expired = sessions.filter((s) => s.status === "expired" && !s.has_report);
  const visibleSessions = sessions.filter(
    (s) => showExpired || !(s.status === "expired" && !s.has_report),
  );

  const items = buildHubItems(visibleSessions, plans);
  const runCount = items.filter((i) => i.kind === "run").length;
  const doneCount = visibleSessions.filter((s) => s.status === "completed").length;
  const planCount = items.filter((i) => i.kind === "plan").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
      <motion.div variants={rise} initial="hidden" animate="show">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Interviews</h1>
          {/* One primary door for creating an interview (Kaan): the K3 assign flow. */}
          <Link
            href={`/w/${workspace.slug}/interviews/new`}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} /> New interview
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
          Every interview for this company as one workflow: plan it, observe it, read its
          report, and follow up. Each card shows where it stands and the next step.
        </p>
        {items.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-faint">
            {planCount > 0 && (
              <span className="tabular">
                <span className="font-semibold text-ink">{planCount}</span> in planning
              </span>
            )}
            <span className="tabular">
              <span className="font-semibold text-ink">{runCount}</span>{" "}
              {runCount === 1 ? "interview" : "interviews"}
            </span>
            <span className="tabular">
              <span className="font-semibold text-ink">{doneCount}</span> completed
            </span>
          </div>
        )}
      </motion.div>

      {items.length === 0 ? (
        <EmptyInterviews />
      ) : (
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="mt-8 space-y-3"
        >
          {items.map((item) => (
            <HubCard key={item.key} workspace={workspace} item={item} />
          ))}
        </motion.div>
      )}

      {expired.length > 0 && (
        <button
          onClick={() => setShowExpired((v) => !v)}
          className="mt-3 text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          {showExpired
            ? "Hide expired invitations."
            : `${expired.length} expired invitation${expired.length === 1 ? "" : "s"} hidden. Show them.`}
        </button>
      )}
    </div>
  );
}

function HubCard({ workspace, item }: { workspace: Workspace; item: HubItem }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const slug = workspace.slug;

  return (
    <motion.div
      variants={rise}
      className="card-hairline flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-surface p-4 hover:border-line-strong"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset",
          item.kind === "plan"
            ? "bg-surface-raised text-ink-soft ring-line"
            : "bg-accent-soft text-accent-ink ring-accent/15",
        )}
      >
        {initials(item.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">
          {item.name}
          {item.role && <span className="font-normal text-ink-faint"> · {item.role}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <StageDots current={item.stage} />
            <span className="font-medium text-ink-soft">{stageLabel(item.stage)}</span>
          </span>
          {item.kind === "run" && (
            <span className="inline-flex items-center gap-1">
              {item.modality === "voice" ? (
                <Mic className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              <span className="capitalize">{item.modality}</span>
            </span>
          )}
        </div>
      </div>

      {/* Status: plan lifecycle chip for a plan card, session status pill for a run. */}
      {item.kind === "plan" ? (
        <PlanStateChip state={item.state} />
      ) : (
        <StatusPill status={item.status} />
      )}

      {/* ONE obvious next action per card (the stage's verb). Other existing stages are
          reachable from the detail page's stage rail — the hub stays one clean action deep. */}
      {item.kind === "plan" ? (
        <Link
          href={`/w/${slug}/plans/${item.planId}`}
          className="group inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
        >
          <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
          {item.state === "AWAITING_APPROVAL"
            ? "Review & approve"
            : item.state === "APPROVED"
              ? "Review & send"
              : "Open plan"}
        </Link>
      ) : item.hasReport ? (
        <Link
          href={`/w/${slug}/report/${item.sessionId}`}
          className="group inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
          View report
        </Link>
      ) : (
        <Link
          href={`/w/${slug}/interviews/${item.sessionId}`}
          className="group inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-1.5 text-sm font-medium text-ink transition-all duration-150 ease-standard hover:bg-surface-raised"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
          {item.status === "active" ? "Observe live" : "Observe"}
        </Link>
      )}

      {/* Delete stays a quiet per-run affordance; the dialog says exactly what leaves. */}
      {item.kind === "run" && (
        <>
          <button
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${item.name}'s interview`}
            title="Delete this interview"
            className="rounded-md p-2 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          {confirmingDelete && (
            <DeleteInterviewDialog
              sessionId={item.sessionId}
              name={item.name}
              onClose={() => setConfirmingDelete(false)}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, pill: "bg-surface-sunken text-ink-soft" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ring-ink/[0.04]",
        s.pill,
      )}
    >
      {s.label}
    </span>
  );
}

function EmptyInterviews() {
  return (
    <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
      <Users className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
      <p className="mt-4 font-display text-xl text-ink">No interviews yet</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Start with New interview, or generate a plan for someone the Company Snapshot
        suggests. Plans appear here as the first stage; once approved and sent, they become
        live interviews you can observe, report on, and follow up.
      </p>
    </div>
  );
}
