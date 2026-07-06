import { notFound } from "next/navigation";
import { get_workspace, get_insights } from "@/lib/live";
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

  const data = await get_insights(workspace.id);
  return <InsightsView data={data} />;
}
