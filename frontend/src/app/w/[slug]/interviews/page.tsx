import { notFound } from "next/navigation";
import { get_workspace, list_sessions } from "@/lib/live";
import { InterviewsView } from "@/components/interviews/InterviewsView";

// Interviews (sessions list, nav-integrity fix). Server-fetches the workspace and its
// interview sessions; each completed one links to its post-interview report.
// force-dynamic: session status is live data, never cache it.
export const dynamic = "force-dynamic";

export default async function InterviewsPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const sessions = await list_sessions(workspace.id);
  return <InterviewsView workspace={workspace} sessions={sessions} />;
}
