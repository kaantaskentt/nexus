import { notFound } from "next/navigation";
import { get_workspace, list_knowledge } from "@/lib/live-server";
import { KnowledgeBaseView } from "@/components/knowledge/KnowledgeBaseView";
import { ContextChat } from "@/components/knowledge/ContextChat";

// Company Context (A21 IA — formerly Knowledge Base): the browsable record store.
// Quarantine is structural (client_visible_claims omits flagged rows and the sentiment
// column), so nothing quarantined can reach this screen. force-dynamic: live admin data.
export const dynamic = "force-dynamic";

export default async function CompanyContextPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const records = await list_knowledge(workspace.id);
  return (
    <>
      {/* Context chat door (Kaan, July 7): cited Q&A + add-as-context over this store. */}
      <div className="mx-auto max-w-6xl px-8 pt-10">
        <ContextChat workspaceId={workspace.id} />
      </div>
      <KnowledgeBaseView records={records} />
    </>
  );
}
