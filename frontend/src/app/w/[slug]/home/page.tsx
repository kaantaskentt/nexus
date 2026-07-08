import { notFound } from "next/navigation";
import { get_workspace, list_snapshot_cards, list_claims } from "@/lib/live-server";
import { SnapshotView } from "@/components/snapshot/SnapshotView";
import { DiscoveryUpload } from "@/components/snapshot/DiscoveryUpload";
import { AddTranscriptDoor } from "@/components/snapshot/AddTranscriptDoor";

// Home — the workspace landing (A21 IA). The Company Snapshot IS home. A tenant with no
// compiled snapshot CARDS gets the guided discovery state — even when raw records already
// exist (the Aurora bug: claims without cards fell through to bare section headings).
// Append-only render: cards carry render_batch; the snapshot updates only after a round
// completes (A3).
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [cards, claims] = await Promise.all([
    list_snapshot_cards(workspace.id),
    list_claims(workspace.id),
  ]);

  if (cards.length === 0) {
    const cfg = workspace.config ?? {};
    // Honest empty state (premium audit P1-4): SCRAPED records are website-scan
    // reference data, not "an earlier upload" — a scraped-only tenant is still a fresh
    // start, and saying otherwise reads as "my upload got lost."
    const interviewClaims = claims.filter((c) => c.tag !== "SCRAPED");
    return (
      <DiscoveryUpload
        workspaceId={workspace.id}
        defaultSpeaker={cfg.contact_person ?? cfg.founder}
        website={cfg.website}
        hasRecords={interviewClaims.length > 0}
        scrapedCount={claims.length - interviewClaims.length}
      />
    );
  }

  // Snapshot exists: the upload hero is gone, but a LATER call must still have a door
  // (Kaan, July 7). Collapsed under the snapshot; append mode compiles into the same store.
  const cfg = workspace.config ?? {};
  return (
    <>
      <SnapshotView workspace={workspace} cards={cards} claims={claims} />
      <AddTranscriptDoor
        workspaceId={workspace.id}
        defaultSpeaker={cfg.contact_person ?? cfg.founder}
      />
    </>
  );
}
