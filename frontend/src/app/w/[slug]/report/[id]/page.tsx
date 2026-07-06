import { notFound } from "next/navigation";
import { get_workspace, get_report } from "@/lib/mocks";
import { ReportView } from "@/components/report/ReportView";

// Post-Interview Report (Phase 6 / stage8). Server-fetches the workspace + the compiled
// report for a plan; the client view owns the step-detail drawer. Admin-only surface.
export default async function ReportPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const [workspace, report] = await Promise.all([
    get_workspace(params.slug),
    get_report(params.id),
  ]);
  if (!workspace || !report) notFound();

  return <ReportView workspace={workspace} report={report} />;
}
