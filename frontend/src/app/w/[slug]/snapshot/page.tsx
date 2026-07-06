import { notFound } from "next/navigation";
import { get_workspace, list_snapshot_cards, list_claims } from "@/lib/live";
import { AppShell } from "@/components";
import { SnapshotView } from "@/components/snapshot/SnapshotView";
import { DiscoveryUpload } from "@/components/snapshot/DiscoveryUpload";

// Company Snapshot (Phase 3 / A3). Server-fetches the workspace, the renderer's
// snapshot cards, and the client-visible claims (for the evidence rail), then hands
// them to the client view that owns the Areas-to-Investigate sidebar interaction.
// A fresh tenant (no cards, no records) gets the guided empty state instead: upload
// the CEO call and watch the snapshot compile (A17 / #6). Append-only render: cards
// carry render_batch; the snapshot updates only after a round completes (A3).
export default async function SnapshotPage({
  params,
}: {
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [cards, claims] = await Promise.all([
    list_snapshot_cards(workspace.id),
    list_claims(workspace.id),
  ]);

  if (cards.length === 0 && claims.length === 0) {
    const cfg = workspace.config ?? {};
    return (
      <AppShell workspace={workspace} active="snapshot">
        <DiscoveryUpload
          workspaceId={workspace.id}
          defaultSpeaker={cfg.contact_person ?? cfg.founder}
          website={cfg.website}
        />
      </AppShell>
    );
  }

  return <SnapshotView workspace={workspace} cards={cards} claims={claims} />;
}
