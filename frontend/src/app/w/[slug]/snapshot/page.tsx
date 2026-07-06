import { notFound } from "next/navigation";
import { get_workspace, list_snapshot_cards, list_claims } from "@/lib/mocks";
import { SnapshotView } from "@/components/snapshot/SnapshotView";

// Company Snapshot (Phase 3 / A3). Server-fetches the workspace, the renderer's
// snapshot cards, and the client-visible claims (for the evidence rail), then hands
// them to the client view that owns the Areas-to-Investigate sidebar interaction.
// Append-only render: cards carry render_batch; snapshot updates only after a full
// round completes (A3) — the UI never mutates mid-interview.
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

  return <SnapshotView workspace={workspace} cards={cards} claims={claims} />;
}
