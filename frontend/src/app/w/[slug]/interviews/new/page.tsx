import { Suspense } from "react";
import { notFound } from "next/navigation";
import { get_workspace, list_plans } from "@/lib/live-server";
import { AssignInterviewFlow } from "@/components/interviews/AssignInterviewFlow";

// New-interview assign flow (K3, image18): the one screen that replaces the
// CustomPlanDoor -> plan -> SendInterviewFlow hop. Server-fetches the workspace; the
// client flow drafts the plan, shapes delivery, refines it, and hands off to the gate.
export const dynamic = "force-dynamic";

export default async function NewInterviewPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  // Known-role suggestions for the (now required) Role field: the distinct roles of people
  // already set up in this workspace. Free-text still; these are just a datalist (ADDENDUM 4.1).
  const plans = await list_plans(workspace.id).catch(() => []);
  const roleSuggestions = Array.from(
    new Set(
      plans.map((p) => p.interviewee_role?.trim()).filter((r): r is string => Boolean(r)),
    ),
  ).sort();
  // AssignInterviewFlow reads useSearchParams (follow-up pre-seed) — needs a Suspense wrap.
  return (
    <Suspense>
      <AssignInterviewFlow workspace={workspace} roleSuggestions={roleSuggestions} />
    </Suspense>
  );
}
