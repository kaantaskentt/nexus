"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, MessageSquare, ArrowRight, Users, Eye } from "lucide-react";
import type { Workspace } from "@/lib/types";
import type { SessionSummary } from "@/lib/live";
import { rise, staggerParent } from "@/lib/variants";
import { cn } from "@/lib/cn";

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

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function InterviewsView({
  workspace,
  sessions,
}: {
  workspace: Workspace;
  sessions: SessionSummary[];
}) {
  const done = sessions.filter((s) => s.status === "completed").length;

  return (
    <>
      <div className="mx-auto max-w-4xl px-8 py-10">
        <motion.div variants={rise} initial="hidden" animate="show">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Interviews</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
            Every interview run for this company and where it stands. Completed interviews
            open their post-interview report.{" "}
            <Link
              href={`/w/${workspace.slug}/plans`}
              className="font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              Interview plans
              <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </p>
          {sessions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-faint">
              <span className="tabular">
                <span className="font-semibold text-ink">{sessions.length}</span>{" "}
                {sessions.length === 1 ? "interview" : "interviews"}
              </span>
              <span className="tabular">
                <span className="font-semibold text-ink">{done}</span> completed
              </span>
            </div>
          )}
        </motion.div>

        {sessions.length === 0 ? (
          <EmptyInterviews />
        ) : (
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="card-hairline mt-8 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
          >
            {sessions.map((s) => (
              <SessionRow key={s.id} workspace={workspace} session={s} />
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}

function SessionRow({
  workspace,
  session: s,
}: {
  workspace: Workspace;
  session: SessionSummary;
}) {
  const name = s.interviewee_name ?? "Interviewee";
  const status = STATUS[s.status] ?? { label: s.status, pill: "bg-surface-sunken text-ink-soft" };
  const ModalityIcon = s.modality === "voice" ? Mic : MessageSquare;

  return (
    <motion.div variants={rise} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">
          {name}
          {s.interviewee_role && (
            <span className="font-normal text-ink-faint"> · {s.interviewee_role}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
          <ModalityIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="capitalize">{s.modality}</span> interview
        </div>
      </div>

      <span
        className={cn(
          "inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ring-ink/[0.04]",
          status.pill,
        )}
      >
        {status.label}
      </span>

      {/* Observer (A19): every session opens its live window — transcript, insights,
          coverage — regardless of report state. The report link stays for compiled ones. */}
      <Link
        href={`/w/${workspace.slug}/interviews/${s.id}`}
        className="group inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-all duration-150 ease-standard hover:border-line-strong hover:bg-surface-raised"
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
        {s.status === "active" ? "Observe live" : "Observe"}
      </Link>
      {s.has_report ? (
        <Link
          href={`/w/${workspace.slug}/report/${s.id}`}
          className="group inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-all duration-150 ease-standard hover:border-line-strong hover:bg-surface-raised"
        >
          View report
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      ) : (
        <span
          title="The report appears once the interview is completed and compiled"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-ink-faint opacity-70"
        >
          No report yet
        </span>
      )}
    </motion.div>
  );
}

function EmptyInterviews() {
  return (
    <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
      <Users className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
      <p className="mt-4 font-display text-xl text-ink">No interviews yet</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Approve an interview plan and send it. Interviews you send appear here with their
        status, and open their report once compiled.
      </p>
    </div>
  );
}
