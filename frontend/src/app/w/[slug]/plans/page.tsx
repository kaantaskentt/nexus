import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { get_workspace, list_plans, list_sessions } from "@/lib/live";
import { PlanStateChip } from "@/components";

// Interview Plans index — one row per plan, state rendered from the lifecycle
// machine (the UI never decides transitions). Click a row for the plan detail; once
// an interview has completed and compiled, a "View report" link appears on its plan.
export default async function PlansPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [plans, sessions] = await Promise.all([
    list_plans(workspace.id),
    list_sessions(workspace.id).catch(() => []),
  ]);
  // Map an interviewee (by name) to their compiled session, so a completed interview
  // links straight to its report — closing the journey without a typed URL.
  const reportByName = new Map(
    sessions
      .filter((s) => s.has_report && s.interviewee_name)
      .map((s) => [s.interviewee_name!.toLowerCase(), s.id]),
  );

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-8">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Interview Plans</h1>
          <p className="mt-2 text-sm text-ink-soft">
            One mission per person. Non-response is a signal: plans age on the board,
            with a single gentle reminder. There is no decline.
          </p>
        </header>

        <ul className="space-y-3">
          {plans.map((plan) => {
            const reportId = plan.interviewee_name
              ? reportByName.get(plan.interviewee_name.toLowerCase())
              : undefined;
            return (
              <li
                key={plan.id}
                className="lift flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-5 hover:border-line-strong"
              >
                <Link href={`/w/${workspace.slug}/plans/${plan.id}`} className="min-w-0 flex-1">
                  <div className="font-display text-lg text-ink">
                    {plan.interviewee_name ?? "Unassigned"}
                  </div>
                  {plan.interviewee_role && (
                    <div className="text-xs uppercase tracking-wide text-ink-faint">
                      {plan.interviewee_role}
                    </div>
                  )}
                  <p className="mt-1.5 line-clamp-1 text-sm text-ink-soft">
                    {plan.mission.goal}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  {reportId && (
                    <Link
                      href={`/w/${workspace.slug}/report/${reportId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft"
                    >
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                      View report
                    </Link>
                  )}
                  <PlanStateChip state={plan.state} />
                </div>
              </li>
            );
          })}
        </ul>
    </div>
  );
}
