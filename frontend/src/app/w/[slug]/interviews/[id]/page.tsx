import { notFound } from "next/navigation";
import { get_workspace, observe_session } from "@/lib/live-server";
import { ObserverView } from "@/components/interview/ObserverView";

// The Observer view (A19): the admin's live window onto one interview session, inside the
// admin shell — same elements as the respondent room, different chrome (correction #2).
// Server-fetches the initial state; the client view polls from there.
export const dynamic = "force-dynamic";

export default async function ObserverPage(
  props: {
    params: Promise<{ slug: string; id: string }>;
  }
) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const initial = await observe_session(workspace.id, params.id).catch(() => null);
  if (!initial) notFound();
  return (
    <ObserverView
      workspaceId={workspace.id}
      sessionId={params.id}
      slug={params.slug}
      initial={initial}
    />
  );
}
