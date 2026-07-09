import Link from "next/link";
import { notFound } from "next/navigation";
import { Network, ArrowRight } from "lucide-react";
import { get_workspace, get_workflows } from "@/lib/live-server";

// Workflows (A21 IA): every mapped workflow in this company, one row each, opening the
// editable workflow view. Workflows are compiled from interviews — the empty state says
// exactly that and points at the action that produces one.
export const dynamic = "force-dynamic";

export default async function WorkflowsPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const workflows = await get_workflows(workspace.id);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Workflows</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
        How the work actually flows, mapped from interviews step by step. Open a workflow
        to review it, correct it, and export its SOP or Skill Blueprint.
      </p>

      {workflows.length === 0 ? (
        <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
          <Network className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
          <p className="mt-4 font-display text-xl text-ink">No workflows mapped yet</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            A workflow is compiled from a completed interview: who does what, in what
            order, with which tools. Run an interview and its workflow appears here.
          </p>
          <Link
            href={`/w/${workspace.slug}/interviews`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
          >
            Go to interviews <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <div className="card-hairline mt-8 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {workflows.map((w) => (
            <Link
              key={w.workflow_id}
              href={`/w/${workspace.slug}/workflow/${w.workflow_id}`}
              className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-raised"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/15">
                <Network className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{w.name}</div>
                <div className="mt-0.5 text-xs text-ink-faint tabular">
                  {w.step_count} {w.step_count === 1 ? "step" : "steps"}
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
