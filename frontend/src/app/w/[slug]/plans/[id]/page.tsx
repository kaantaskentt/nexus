import { notFound } from "next/navigation";
import { get_workspace, get_plan, list_sessions } from "@/lib/live-server";
import { PlanView } from "@/components/plan/PlanView";

// Interview Plan detail (Phase 3 / A4). Server-fetches the workspace + plan (and, once
// the interview has completed and compiled, the session whose report this plan links to)
// then hands off to the client view that owns approve → send → status.
export default async function PlanDetailPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const plan = await get_plan(workspace.id, params.id);
  if (!plan) notFound();

  // A completed interview for this interviewee links straight to its report.
  const sessions = await list_sessions(workspace.id).catch(() => []);
  const reportSessionId = plan.interviewee_name
    ? sessions.find(
        (s) =>
          s.has_report &&
          s.interviewee_name?.toLowerCase() === plan.interviewee_name!.toLowerCase(),
      )?.id
    : undefined;

  return (
    <PlanView workspace={workspace} plan={plan} reportSessionId={reportSessionId} />
  );
}
