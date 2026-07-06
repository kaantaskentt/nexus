"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Loader2, Check, Search } from "lucide-react";
import { trigger_recon, recon_status, type ReconStatus } from "@/lib/live";

// Optional Stage-1 website scan (A17 / #7). Best-effort and non-blocking: it never gates
// the CEO call. Results land as SCRAPED reference records (~20% weight, scraped != verified)
// that enrich the snapshot once the call compiles. A scrape that reaches nothing finishes
// quietly as "found nothing", never a hard error.
type Phase = "idle" | "scanning" | "done";

export function WebsiteScan({
  workspaceId,
  website,
}: {
  workspaceId: string;
  website: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ReconStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function scan() {
    setPhase("scanning");
    try {
      const { job_id } = await trigger_recon(workspaceId, website);
      pollRef.current = setInterval(async () => {
        try {
          const s = await recon_status(workspaceId, job_id);
          if (s.job_status === "done" || s.job_status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setResult(s);
            setPhase("done");
          }
        } catch {
          // transient — keep polling
        }
      }, 2000);
    } catch {
      // Best-effort: a failed trigger just returns to idle so the CEO call is unaffected.
      setPhase("idle");
    }
  }

  const host = website.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="mt-6 flex items-center gap-3 rounded-card border border-line bg-surface-sunken/60 px-4 py-3 text-left">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft ring-1 ring-inset ring-line">
        <Globe className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">Scan the website first</div>
        <div className="truncate text-xs text-ink-faint">
          {phase === "done"
            ? result && result.scraped_records > 0
              ? `Captured ${result.scraped_records} reference point${result.scraped_records === 1 ? "" : "s"}${result.people ? ` and ${result.people} people` : ""}. Scraped, so they stay low-confidence until the call confirms them.`
              : "Found nothing usable on the site. No problem, the call is what matters."
            : `Optional. Pulls low-confidence context from ${host} to enrich the snapshot.`}
        </div>
      </div>
      {phase === "idle" && (
        <button
          onClick={scan}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={2} />
          Scan
        </button>
      )}
      {phase === "scanning" && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-soft">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          Scanning
        </span>
      )}
      {phase === "done" && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-success">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Done
        </span>
      )}
    </div>
  );
}
