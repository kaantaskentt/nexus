import { notFound } from "next/navigation";
import { get_workspace, get_effective_workflow } from "@/lib/live";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";

// Workflow editor route (V2 #21). Loads the folded "effective" workflow (immutable base +
// admin overlays) for the editor. Edits post overlays; the base is never mutated.
export default async function WorkflowEditorPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const workflow = await get_effective_workflow(params.id).catch(() => null);
  if (!workflow) notFound();

  return <WorkflowEditor workspace={workspace} workflow={workflow} />;
}
