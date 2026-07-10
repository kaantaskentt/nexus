"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, AlertTriangle, GitBranch, Loader2, Play, ArrowRight } from "lucide-react";
import { run_scenario, type SimulationScenario } from "@/lib/live";
import { WorkflowConfidenceChip } from "@/components/workflow/WorkflowConfidenceChip";

// SIMPLIFY I: the primary Simulations content — scenarios derived from THIS workspace's real
// workflows. Run mints a roleplay-kind session for the workflow (lane-e's mint derives the
// archetype + objectives server-side; only workflow_id crosses) and opens the LiveRoom.
export function ScenariosSection({
  workspaceId,
  scenarios,
}: {
  workspaceId: string;
  scenarios: SimulationScenario[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(s: SimulationScenario) {
    setBusyId(s.workflow_id);
    setError(null);
    try {
      const { invite_path } = await run_scenario(workspaceId, s.workflow_id);
      router.push(invite_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the simulation. Try again.");
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
        <FlaskConical className="h-4 w-4" strokeWidth={1.75} /> Practice against your workflows
      </h2>
      {error && (
        <p className="mt-2 text-sm font-medium text-danger">{error}</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {scenarios.map((s) => (
          <div key={s.workflow_id} className="card-hairline flex flex-col rounded-card border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug text-ink">{s.label}</h3>
              <WorkflowConfidenceChip confidence={s.signals.confidence} />
            </div>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">{s.tests_summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-faint">
              <span className="tabular">{s.step_count} steps</span>
              {s.signals.has_exceptions && (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} /> exceptions
                </span>
              )}
              {s.signals.has_decisions && (
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" strokeWidth={1.75} /> decision points
                </span>
              )}
            </div>
            <button
              onClick={() => run(s)}
              disabled={busyId !== null}
              className="mt-4 inline-flex items-center justify-center gap-1.5 self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:opacity-60"
            >
              {busyId === s.workflow_id ? (
                <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> Starting…</>
              ) : (
                <><Play className="h-4 w-4" strokeWidth={1.75} /> Run simulation</>
              )}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        A simulation is a practice run against a real workflow. Nothing said in one touches
        your company records. <ArrowRight className="inline h-3 w-3" strokeWidth={2} />
      </p>
    </section>
  );
}
