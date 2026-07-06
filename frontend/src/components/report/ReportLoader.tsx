"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import type { Report, Workspace } from "@/lib/types";
import { get_report, reportIsCompiling } from "@/lib/live";
import { AppShell } from "@/components";
import { ReportView } from "./ReportView";

// Reports populate progressively after the interview /complete: compile runs first,
// then pain/workflow/perception-gaps/quality fan out over a few seconds. So we poll
// while the report is still compiling and show an honest "compiling…" state rather
// than an empty shell — never treat an early empty report as final.
export function ReportLoader({
  workspace,
  sessionId,
  meta,
  initialReport,
}: {
  workspace: Workspace;
  sessionId: string;
  meta?: { interviewee_name?: string; interviewee_role?: string };
  initialReport: Report;
}) {
  const [report, setReport] = useState<Report>(initialReport);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nothing has landed yet → full-page "compiling". Some sections landed but the
  // workflow (the payoff) is still fanning out → render what's here and keep polling,
  // with the canvas showing its own placeholder (ReportView handles that).
  const fullCompiling = reportIsCompiling(report);
  const workflowPending = report.steps.length === 0;

  useEffect(() => {
    if (!workflowPending) return; // fully populated — stop polling
    let tries = 0;
    timer.current = setInterval(async () => {
      tries += 1;
      try {
        const next = await get_report(sessionId, meta);
        if (next) setReport(next);
      } catch {
        /* transient — keep polling */
      }
      // Cap at ~40s so a genuinely workflow-less report doesn't poll forever.
      if (tries >= 20 && timer.current) clearInterval(timer.current);
    }, 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [workflowPending, sessionId, meta]);

  if (fullCompiling) {
    return (
      <AppShell workspace={workspace} active="plans">
        <div className="mx-auto max-w-md px-8 py-24 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl text-ink">Compiling the report…</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            The interview just finished. We&apos;re turning the conversation into a
            verified workflow, findings, and follow-ups — this takes a few seconds and
            updates here as each part lands.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Visible to admins only
          </p>
        </div>
      </AppShell>
    );
  }

  return <ReportView workspace={workspace} report={report} />;
}
