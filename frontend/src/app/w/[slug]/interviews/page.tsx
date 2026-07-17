import { notFound } from "next/navigation";
import { get_workspace, list_sessions, list_plans } from "@/lib/live-server";
import { InterviewsView } from "@/components/interviews/InterviewsView";

// Interviews hub (Feedback-K): one staged workflow per interview. Server-fetches the
// workspace, its interview sessions (runs) and its plans (planning stage), then hands off
// to the client hub that merges them into stage cards. The old /plans list folds in here.
// force-dynamic: session + plan status is live data, never cache it.
export const dynamic = "force-dynamic";

export default async function InterviewsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [sessions, plans] = await Promise.all([
    list_sessions(workspace.id),
    list_plans(workspace.id).catch(() => []),
  ]);
  return <InterviewsView workspace={workspace} sessions={sessions} plans={plans} />;
}
