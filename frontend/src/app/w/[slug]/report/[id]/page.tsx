import { notFound } from "next/navigation";
import { get_workspace, get_report, list_sessions } from "@/lib/live";
import { ReportView } from "@/components/report/ReportView";

// Post-Interview Report (Phase 6 / stage8). The [id] segment is the interview
// session_id (the report is keyed by session, not plan). Server-fetches the workspace
// + the compiled report; the client view owns the step-detail drawer. Admin-only.
export default async function ReportPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  // Interviewee name/role for the header come from the session summary.
  const sessions = await list_sessions(workspace.id).catch(() => []);
  const sess = sessions.find((s) => s.id === params.id);

  const report = await get_report(params.id, {
    interviewee_name: sess?.interviewee_name ?? undefined,
    interviewee_role: sess?.interviewee_role ?? undefined,
  });
  if (!report) notFound();

  return <ReportView workspace={workspace} report={report} />;
}
