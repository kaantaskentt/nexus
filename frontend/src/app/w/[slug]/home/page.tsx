import { notFound } from "next/navigation";
import { get_workspace, list_snapshot_cards, list_claims, list_plans } from "@/lib/live-server";
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

  const [cards, claims, plans] = await Promise.all([
    list_snapshot_cards(workspace.id),
    list_claims(workspace.id),
    // Plans keep the suggested-people rows honest (Emre doc-2 P2: Home still offered
    // "Generate plan" for a person whose interview had already completed). Home is
    // force-dynamic, so every visit reflects the real lifecycle.
    list_plans(workspace.id).catch(() => []),
  ]);

  // Latest plan per person (list is newest-first) — keyed by folded name because the
  // card content carries name+entity_id but plans resolve people by entity.
  const personPlans: Record<string, { id: string; state: string }> = {};
  for (const p of plans) {
    const key = p.interviewee_name?.trim().toLowerCase();
    if (key && !personPlans[key]) personPlans[key] = { id: p.id, state: p.state };
  }

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
        industry={workspace.industry}
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
      <SnapshotView workspace={workspace} cards={cards} claims={claims} personPlans={personPlans} />
      <AddTranscriptDoor
        workspaceId={workspace.id}
        defaultSpeaker={cfg.contact_person ?? cfg.founder}
      />
    </>
  );
}
