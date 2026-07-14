"use client";

import { useEffect, useRef, useState } from "react";
import { Microscope, Loader2, Check, RotateCw, AlertTriangle } from "lucide-react";
import {
  trigger_deep_research,
  deep_research_status,
  type DeepResearchCase,
} from "@/lib/live";

// Deep Research Knowledge Base — Phase 1 manual admin trigger
// (docs/PRD-DEEP-RESEARCH-KB.md §5, §11). Admin-only (never rendered for a client seat —
// gated by the caller): this is internal calibration content, not a client-visible
// finding. The job itself runs on the backend worker, fully decoupled from this tab — it
// keeps going whether or not this page stays open. What THIS component has to get right
// is the reverse case: on mount (including a mid-run refresh), it resolves the workspace's
// latest job from the server rather than assuming "no local state" means "nothing is
// running" — otherwise a refresh mid-run would silently drop back to idle and offer the
// button again, racing a second, fully duplicate pass against the first (the backend's
// regenerate endpoint also guards this server-side, but the UI should never invite it).
type Phase = "loading" | "idle" | "running" | "done" | "failed";
const POLL_MS = 3000;

export function DeepResearchTrigger({
  workspaceId,
  industry,
}: {
  workspaceId: string;
  industry?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<DeepResearchCase | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollJob(jobId: number) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await deep_research_status(workspaceId, jobId);
        if (s.job_status === "done" || s.job_status === "failed") {
          stopPolling();
          setResult(s.case);
          // A run that raised (job_status "failed") is reported as failed even if a
          // stale case exists from an earlier successful pass — the user just watched
          // this attempt fail and should be told so, not shown old data silently.
          setPhase(s.job_status === "failed" ? "failed" : s.case ? "done" : "failed");
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
  }

  useEffect(() => {
    let cancelled = false;
    deep_research_status(workspaceId)
      .then((s) => {
        if (cancelled) return;
        setResult(s.case);
        if (s.job_status === "queued" || s.job_status === "running") {
          setPhase("running");
          if (s.job_id) pollJob(s.job_id); // resume — a refresh mid-run picks back up here
        } else if (s.job_status === "failed" && !s.case) {
          setPhase("failed");
        } else {
          setPhase(s.case ? "done" : "idle");
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("idle");
      });
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function run() {
    setPhase("running");
    try {
      const { job_id } = await trigger_deep_research(workspaceId);
      pollJob(job_id);
    } catch {
      // Best-effort: a failed trigger just returns to idle, same as the recon button.
      setPhase("idle");
    }
  }

  function regenerate() {
    if (
      window.confirm(
        `Re-run deep research for ${industry ? `the ${industry} vertical` : "this vertical"}? ` +
          "This replaces the current findings once the new pass completes.",
      )
    ) {
      run();
    }
  }

  return (
    <section className="mx-auto -mt-6 max-w-4xl px-8 pb-12">
      <div className="flex items-center gap-4 rounded-card border border-line bg-surface px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft ring-1 ring-inset ring-line">
          <Microscope className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">Deep research</div>
          <div className="truncate text-xs text-ink-faint">
            {phase === "loading" && "Checking for existing research…"}
            {phase === "idle" &&
              `Grounded, cited research on how ${industry ? `${industry} businesses` : "this kind of business"} typically operate — sharpens interviews and definitions of done. Runs on the server; safe to navigate away.`}
            {phase === "running" &&
              "Researching the vertical — this keeps running even if you close this page."}
            {phase === "failed" && "The last research pass failed. Safe to try again."}
            {phase === "done" && result && (
              <>
                {result.findings} finding{result.findings === 1 ? "" : "s"} ·{" "}
                {result.dod_met ? "complete" : "partial — didn't fully meet the completion bar"}
              </>
            )}
          </div>
        </div>
        {phase === "idle" && (
          <button
            onClick={run}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            <Microscope className="h-3.5 w-3.5" strokeWidth={2} />
            Run deep research
          </button>
        )}
        {phase === "running" && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            Researching
          </span>
        )}
        {phase === "failed" && (
          <button
            onClick={run}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:border-danger"
          >
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            Try again
          </button>
        )}
        {phase === "done" && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Done
            </span>
            <button
              onClick={regenerate}
              title="Re-run — replaces the current findings once the new pass completes"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-faint transition-colors hover:border-accent hover:text-accent"
            >
              <RotateCw className="h-3 w-3" strokeWidth={2} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
