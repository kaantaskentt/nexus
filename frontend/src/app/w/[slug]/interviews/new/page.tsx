import { notFound } from "next/navigation";
import { get_workspace } from "@/lib/live-server";
import { AssignInterviewFlow } from "@/components/interviews/AssignInterviewFlow";

// New-interview assign flow (K3, image18): the one screen that replaces the
// CustomPlanDoor -> plan -> SendInterviewFlow hop. Server-fetches the workspace; the
// client flow drafts the plan, shapes delivery, refines it, and hands off to the gate.
export const dynamic = "force-dynamic";

export default async function NewInterviewPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  return <AssignInterviewFlow workspace={workspace} />;
}
