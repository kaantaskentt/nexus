import Link from "next/link";
import { notFound } from "next/navigation";
import { get_workspace, list_plans } from "@/lib/live";
import { AppShell, PlanStateChip } from "@/components";

// Interview Plans index — one row per plan, state rendered from the lifecycle
// machine (the UI never decides transitions). Click through to the plan detail.
export default async function PlansPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const plans = await list_plans(workspace.id);

  return (
    <AppShell workspace={workspace} active="plans">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">Interview Plans</h1>
          <p className="mt-1 text-sm text-ink-soft">
            One mission per person. Non-response is a signal — plans age on the board,
            with a single gentle reminder. There is no decline.
          </p>
        </header>

        <ul className="space-y-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/w/${workspace.slug}/plans/${plan.id}`}
                className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <div className="font-display text-lg text-ink">
                    {plan.interviewee_name ?? "Unassigned"}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-ink-faint">
                    {plan.interviewee_role ?? "—"}
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm text-ink-soft">
                    {plan.mission.goal}
                  </p>
                </div>
                <PlanStateChip state={plan.state} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
