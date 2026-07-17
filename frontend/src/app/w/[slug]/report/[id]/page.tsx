import { notFound } from "next/navigation";
import { get_workspace, get_report, list_sessions } from "@/lib/live-server";
import { ReportLoader } from "@/components/report/ReportLoader";

// Post-Interview Report (Phase 6 / stage8). The [id] segment is the interview
// session_id (the report is keyed by session, not plan). Server-fetches the first
// snapshot; the client loader polls while the report is still compiling.
export default async function ReportPage(
  props: {
    params: Promise<{ slug: string; id: string }>;
  }
) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  // Interviewee name/role for the header come from the session summary.
  const sessions = await list_sessions(workspace.id).catch(() => []);
  const sess = sessions.find((s) => s.id === params.id);
  const meta = {
    interviewee_name: sess?.interviewee_name ?? undefined,
    interviewee_role: sess?.interviewee_role ?? undefined,
  };

  const report = await get_report(params.id, meta);
  if (!report) notFound();

  return (
    <ReportLoader
      workspace={workspace}
      sessionId={params.id}
      meta={meta}
      initialReport={report}
    />
  );
}
