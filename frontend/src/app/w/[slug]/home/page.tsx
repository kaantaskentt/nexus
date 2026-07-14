import { notFound } from "next/navigation";
import {
  get_workspace,
  get_weekly_pulse,
  list_snapshot_cards,
  list_claims,
  list_plans,
  get_workflows,
  get_insights,
  get_automation,
  get_active_discovery,
} from "@/lib/live-server";
import { SnapshotView } from "@/components/snapshot/SnapshotView";
import { DiscoveryUpload } from "@/components/snapshot/DiscoveryUpload";
import { AddTranscriptDoor } from "@/components/snapshot/AddTranscriptDoor";
import { WeeklyPulseCard } from "@/components/snapshot/WeeklyPulseCard";
import {
  SnapshotIntro,
  type IntroStat,
  type IntroCategory,
} from "@/components/snapshot/SnapshotIntro";

// Home — the workspace landing (A21 IA). The Company Snapshot IS home. A tenant with no
// compiled snapshot CARDS gets the guided discovery state — even when raw records already
// exist (the Aurora bug: claims without cards fell through to bare section headings).
// Append-only render: cards carry render_batch; the snapshot updates only after a round
// completes (A3).
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { compiling?: string; finding?: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const findingParam = searchParams?.finding?.trim() || null;
  const [cards, claims, plans, workflows, insights, automation, activeDiscovery] =
    await Promise.all([
      list_snapshot_cards(workspace.id),
      list_claims(workspace.id),
      // Plans keep the suggested-people rows honest (Emre doc-2 P2: Home still offered
      // "Generate plan" for a person whose interview had already completed). Home is
      // force-dynamic, so every visit reflects the real lifecycle.
      list_plans(workspace.id).catch(() => []),
      // A real workflow count for the snapshot intro's "Workflows detected" stat (B).
      get_workflows(workspace.id).catch(() => []),
      // Folded from the retired Insights tab (ADD-3.3): key findings + automation
      // opportunities now render on Home, their one canonical surface. Non-critical to the
      // page, so a fetch hiccup degrades to no section, never a broken Home.
      get_insights(workspace.id).catch(() => null),
      get_automation(workspace.id).catch(() => []),
      // In-flight compile resume (refresh mid-extract keeps the progress board). Fail-soft:
      // a hiccup here must never blank Home.
      get_active_discovery(workspace.id).catch(() => null),
    ]);

  // Latest plan per person (list is newest-first) — keyed by folded name because the
  // card content carries name+entity_id but plans resolve people by entity.
  const personPlans: Record<string, { id: string; state: string }> = {};
  for (const p of plans) {
    const key = p.interviewee_name?.trim().toLowerCase();
    if (key && !personPlans[key]) personPlans[key] = { id: p.id, state: p.state };
  }

  const cfg = workspace.config ?? {};
  // URL ?compiling= wins; otherwise the newest server-side in-flight discovery/context.
  const resumeSessionId =
    searchParams?.compiling?.trim() ||
    (activeDiscovery?.state === "running" ? activeDiscovery.session_id : undefined);

  // Progress board survives refresh / reconnect: if a compile is still running, show it
  // even when cards already exist (append upload) so the UI is not lost under the snapshot.
  if (resumeSessionId) {
    const interviewClaims = claims.filter((c) => c.tag !== "SCRAPED");
    return (
      <DiscoveryUpload
        workspaceId={workspace.id}
        defaultSpeaker={cfg.contact_person ?? cfg.founder}
        website={cfg.website}
        industry={workspace.industry}
        hasRecords={interviewClaims.length > 0}
        scrapedCount={claims.length - interviewClaims.length}
        contextCallBeta={Boolean(cfg.beta_context_call)}
        append={cards.length > 0}
        resumeSessionId={resumeSessionId}
      />
    );
  }

  if (cards.length === 0) {
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
        contextCallBeta={Boolean(cfg.beta_context_call)}
      />
    );
  }

  // Snapshot exists: the upload hero is gone, but a LATER call must still have a door
  // (Kaan, July 7). Collapsed under the snapshot; append mode compiles into the same store.
  // F3 Weekly Pulse: renders ONLY when the Settings toggle is on (off by default) —
  // a workspace with the flag off is byte-for-byte the page it was before F3.
  const pulse = cfg.weekly_pulse
    ? await get_weekly_pulse(workspace.id).catch(() => null)
    : null;

  const snapshotBody = (
    <>
      <SnapshotView
        workspace={workspace}
        cards={cards}
        claims={claims}
        personPlans={personPlans}
        workflowCount={workflows.length}
        keyFindings={insights?.key_findings ?? []}
        automation={automation}
        workflowIds={workflows.map((w) => w.workflow_id)}
        finding={findingParam}
      />
      {pulse?.enabled && <WeeklyPulseCard pulse={pulse} />}
      <AddTranscriptDoor
        workspaceId={workspace.id}
        defaultSpeaker={cfg.contact_person ?? cfg.founder}
      />
    </>
  );

  // SIMPLIFY B: the first-snapshot intro renders once, before the snapshot itself, until
  // the founder dismisses it (config.snapshot_intro_seen). Every stat is a REAL count with a
  // real destination — a count we cannot derive honestly is simply not shown.
  if (!cfg.snapshot_intro_seen) {
    const learned = cards.filter((c) => c.card_type === "learned");
    const areas = cards.filter((c) => c.card_type === "area_to_investigate");
    const people = cards.filter((c) => c.card_type === "suggested_person");
    const conflicts = cards.filter((c) => c.card_type === "conflict_point");
    const recordsCompiled = claims.filter((c) => c.tag !== "SCRAPED").length;

    const stats: IntroStat[] = [
      { key: "records", label: "Records compiled", value: recordsCompiled },
      { key: "people", label: "People identified", value: people.length },
      { key: "workflows", label: "Workflows detected", value: workflows.length },
      { key: "areas", label: "Areas to investigate", value: areas.length },
      { key: "conflicts", label: "Perception gaps", value: conflicts.length },
    ].filter((s) => s.value > 0);

    const categories: IntroCategory[] = [
      {
        key: "overview",
        title: "Company overview",
        desc: "A first model of the company and how work gets done.",
        count: learned.length,
        unit: "insights",
      },
      {
        key: "people",
        title: "People",
        desc: "Key people involved and how they contribute.",
        count: people.length,
        unit: "people",
      },
      {
        key: "workflows",
        title: "Workflows",
        desc: "Core workflows we detected and how work moves.",
        count: workflows.length,
        unit: "workflows",
      },
      {
        key: "areas",
        title: "Areas to investigate",
        desc: "Where we need more clarity to go deeper.",
        count: areas.length,
        unit: "areas",
      },
      {
        key: "conflicts",
        title: "Perception gaps",
        desc: "Where leadership belief and floor reality diverge.",
        count: conflicts.length,
        unit: "gaps",
      },
    ].filter((c) => c.count > 0);

    return (
      <SnapshotIntro
        workspaceId={workspace.id}
        companyName={workspace.name}
        stats={stats}
        categories={categories}
      >
        {snapshotBody}
      </SnapshotIntro>
    );
  }

  return snapshotBody;
}
