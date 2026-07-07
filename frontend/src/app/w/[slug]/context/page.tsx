import { notFound } from "next/navigation";
import { get_workspace, list_knowledge } from "@/lib/live-server";
import { KnowledgeBaseView } from "@/components/knowledge/KnowledgeBaseView";

// Company Context (A21 IA — formerly Knowledge Base): the browsable record store.
// Quarantine is structural (client_visible_claims omits flagged rows and the sentiment
// column), so nothing quarantined can reach this screen. force-dynamic: live admin data.
export const dynamic = "force-dynamic";

export default async function CompanyContextPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const records = await list_knowledge(workspace.id);
  return <KnowledgeBaseView records={records} />;
}
