import { notFound } from "next/navigation";
import { get_workspace, list_knowledge } from "@/lib/live";
import { KnowledgeBaseView } from "@/components/knowledge/KnowledgeBaseView";

// Knowledge Base (record store, MORNING-ORDERS priority 1). Server-fetches the
// workspace and every client-visible record, then hands them to the browsable,
// faceted view. Quarantine is structural (client_visible_claims omits the flagged
// rows and the sentiment column), so nothing quarantined can reach this screen.
// force-dynamic: live admin data must never serve from Next's fetch cache.
export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const records = await list_knowledge(workspace.id);
  return <KnowledgeBaseView records={records} />;
}
