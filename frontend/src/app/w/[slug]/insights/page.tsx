import { notFound } from "next/navigation";
import { get_workspace, get_insights, get_automation, get_workflows, list_claims } from "@/lib/live-server";
import { InsightsView } from "@/components/insights/InsightsView";

// Insights (cross-interview intelligence, MORNING-ORDERS priority 1). Server-fetches the
// workspace and the computed conflicts/findings/admissions, then hands them to the view.
// force-dynamic: this is live admin data, so it must never serve from Next's fetch cache.
export const dynamic = "force-dynamic";

export default async function InsightsPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [data, automation, workflows, claims] = await Promise.all([
    get_insights(workspace.id),
    get_automation(workspace.id).catch(() => []),
    get_workflows(workspace.id).catch(() => []),
    list_claims(workspace.id).catch(() => []),
  ]);
  return (
    <InsightsView
      data={data}
      automation={automation}
      slug={params.slug}
      // Only link into workflows that actually resolve TODAY (Kaan P1, July 8): an
      // opportunity whose workflow is gone falls back to inline evidence, never a 404.
      workflowIds={workflows.map((w) => w.workflow_id)}
      claims={claims}
    />
  );
}
