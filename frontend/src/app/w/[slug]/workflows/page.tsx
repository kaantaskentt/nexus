import Link from "next/link";
import { notFound } from "next/navigation";
import { Network, ArrowRight } from "lucide-react";
import { get_workspace, get_workflows } from "@/lib/live-server";
import { WorkflowsList } from "@/components/workflow/WorkflowsList";

// Workflows (A21 IA + SIMPLIFY C): every mapped workflow in this company, grouped by
// department when Nexus is confident of one, each opening the editable workflow view.
// Workflows are compiled from interviews — the empty state says exactly that and points at
// the action that produces one.
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
        <>
          <WorkflowsList slug={workspace.slug} workflows={workflows} />
          <p className="mt-4 text-xs text-ink-faint">
            This is every workflow mapped so far. Each new interview can add one or refine
            one that is already here.
          </p>
        </>
      )}
    </div>
  );
}
