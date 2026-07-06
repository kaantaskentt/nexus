import { notFound } from "next/navigation";
import { get_workspace, get_plan } from "@/lib/live";
import { PlanView } from "@/components/plan/PlanView";

// Interview Plan detail (Phase 3 / A4). Server-fetches the workspace + plan, hands
// off to the client view that owns the Send Interview flow (details → preview →
// send → status tracking). The lifecycle state is authoritative from the backend;
// the flow only requests transitions.
export default async function PlanDetailPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const plan = await get_plan(workspace.id, params.id);
  if (!plan) notFound();

  return <PlanView workspace={workspace} plan={plan} />;
}
