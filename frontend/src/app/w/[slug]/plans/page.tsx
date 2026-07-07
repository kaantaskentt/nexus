import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowRight } from "lucide-react";
import { get_workspace, list_plans, list_sessions } from "@/lib/live-server";
import { PlanStateChip } from "@/components";

function shortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

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

  // A completed interview must be reachable from Plans even when it has no plan row —
  // otherwise it shows on Interviews but vanishes here (YC-AUDIT #10). Surface those
  // orphan sessions in their own section rather than dropping them.
  const planNames = new Set(
    plans.map((p) => p.interviewee_name?.toLowerCase()).filter(Boolean) as string[],
  );
  const orphanInterviews = sessions.filter(
    (s) =>
      s.status === "completed" &&
      s.has_report &&
      s.interviewee_name &&
      !planNames.has(s.interviewee_name.toLowerCase()),
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

        {/* Designed empty state (EMRE sprint target 2): guide the action that creates the
            first plan instead of a bare heading over nothing. */}
        {plans.length === 0 && orphanInterviews.length === 0 && (
          <div className="card-hairline flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
            <FileText className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
            <p className="mt-4 font-display text-xl text-ink">No interview plans yet</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Plans are drafted from the Company Snapshot: each suggested person gets one
              mission, and you approve it before anything reaches them. Start from Home:
              once the snapshot exists, generate a plan for someone it suggests.
            </p>
            <Link
              href={`/w/${workspace.slug}/home`}
              className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
            >
              Go to Home <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        )}

        <ul className="space-y-3">
          {plans.map((plan) => {
            const reportId = plan.interviewee_name
              ? reportByName.get(plan.interviewee_name.toLowerCase())
              : undefined;
            const created = shortDate(plan.created_at);
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
                  {/* Created date disambiguates two plans for the same person (#10). */}
                  {created && (
                    <p className="mt-1 text-xs text-ink-faint">Created {created}</p>
                  )}
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

        {orphanInterviews.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Completed interviews without a plan
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              These ran before the plan board existed. Their reports are here.
            </p>
            <ul className="mt-4 space-y-3">
              {orphanInterviews.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg text-ink">{s.interviewee_name}</div>
                    {s.interviewee_role && (
                      <div className="text-xs uppercase tracking-wide text-ink-faint">
                        {s.interviewee_role}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/w/${workspace.slug}/report/${s.id}`}
                    className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft"
                  >
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                    View report
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
    </div>
  );
}
