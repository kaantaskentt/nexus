import { notFound } from "next/navigation";
import { get_workspace, get_effective_workflow } from "@/lib/live-server";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";

// Workflow editor route (V2 #21). Loads the folded "effective" workflow (immutable base +
// admin overlays) for the editor. Edits post overlays; the base is never mutated.
//
// July 8 (Emre report #9 + #4): the back link reflects the actual origin — each entry
// point declares itself via ?from= (report:<sessionId> | skills | default workflows) —
// and ?panel=sop deep-opens the SOP drawer so the report's Generate SOP lands on the
// working feature, not a stub.
export default async function WorkflowEditorPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams?: { from?: string; panel?: string; highlight?: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const workflow = await get_effective_workflow(params.id).catch(() => null);
  if (!workflow) notFound();

  const from = searchParams?.from ?? "";
  const reportSession = from.startsWith("report:")
    ? from.slice("report:".length).replace(/[^A-Za-z0-9-]/g, "")
    : null;
  const back = reportSession
    ? { href: `/w/${params.slug}/report/${reportSession}`, label: "Back to report" }
    : from === "skills"
      ? { href: `/w/${params.slug}/skills`, label: "Back to Agent Skills" }
      : from === "insights"
        ? { href: `/w/${params.slug}/insights`, label: "Back to Insights" }
        : { href: `/w/${params.slug}/workflows`, label: "Back to Workflows" };
  // Automation opportunity deep link (Kaan F2+3): ?highlight=stepA,stepB rings the
  // automatable steps so the click from Insights lands on the exact toil.
  const highlight = (searchParams?.highlight ?? "").split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <WorkflowEditor
      workspace={workspace}
      workflow={workflow}
      back={back}
      initialPanel={searchParams?.panel === "sop" ? "sop" : null}
      highlightStepIds={highlight}
    />
  );
}
