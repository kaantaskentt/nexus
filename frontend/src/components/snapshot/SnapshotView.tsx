"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, Lock, ArrowRight, X, Quote, ClipboardCheck, Flame, Calculator } from "lucide-react";
import Link from "next/link";
import type {
  AreaContent,
  ClaimRecord,
  ClaimTopic,
  ConflictContent,
  KeyFinding,
  LearnedContent,
  PlanState,
  SnapshotCard,
  SuggestedPersonContent,
  Workspace,
} from "@/lib/types";
import type { AutomationOpportunity } from "@/lib/live";
import {
  ConfidenceBadge,
  EvidenceQuoteCard,
  PainBandChip,
  PersonRow,
  PlanStateChip,
} from "@/components";
import { TOPIC_META, NEUTRAL_TOPIC } from "@/lib/topics";
import { rise, staggerParent, drawerSpring, scrimFade, drawerSection } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";
import brand from "@/lib/brand";
import { GeneratePlanButton } from "./GeneratePlanButton";
import { ExportReportButton } from "./ExportReportButton";
import { AddMoreContextButton } from "./AddMoreContextButton";

// The quote a claim shows in the evidence rail (same fallback EvidenceQuoteCard uses).
function railQuote(c: ClaimRecord): string {
  return (c.evidence_quote ?? c.claim_text).replace(/^\[paraphrased\]\s*/i, "");
}

function normalizeQuote(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/["'.,;:!?—-]+$/g, "").trim();
}

// Two claim records can legitimately cite overlapping transcript spans (a short
// admission and the fuller sentence that contains it). Rendering both leaves the rail
// showing a fragment and its own containing quote as separate cards. Dedup at the RENDER
// layer only — keep the fuller quote, drop the contained fragment (and exact repeats).
// The records are never touched (tags never upgrade, records never edited).
function dedupeEvidenceByContainment(claims: ClaimRecord[]): ClaimRecord[] {
  const withQuote = claims.map((c) => ({ c, q: normalizeQuote(railQuote(c)) }));
  return withQuote
    .filter(({ q }, i) =>
      !withQuote.some(
        (other, j) =>
          j !== i &&
          other.q.includes(q) &&
          (other.q.length > q.length || (other.q === q && j < i)),
      ),
    )
    .map(({ c }) => c);
}

// Findings attribute by ROLE by default (reflect-back-close Beat 3, hard-rule 8): the
// respondent's name is quarantined at this render surface unless they explicitly released
// it. Returns the label to show, or null when there's nothing safe to render. Ported with
// the fold from InsightsView so the quarantine rule travels with the finding card.
function attributionLabel(
  speaker: string | null,
  role: string | null,
  released?: boolean,
): string | null {
  if (released && speaker) return role ? `${speaker} · ${role}` : speaker;
  return role;
}

export function SnapshotView({
  workspace,
  cards,
  claims,
  personPlans = {},
  workflowCount = 0,
  keyFindings = [],
  automation = [],
  workflowIds = [],
}: {
  workspace: Workspace;
  cards: SnapshotCard[];
  claims: ClaimRecord[];
  // Latest plan per suggested person (folded name → {id, state}), resolved server-side
  // so the row shows the REAL lifecycle instead of a stale "Generate plan" (Emre P2).
  personPlans?: Record<string, { id: string; state: string }>;
  // Real workflow count for the story-so-far glance (3.2). The page already fetches it for
  // the intro; a count only, never a fabricated number.
  workflowCount?: number;
  // Folded from the retired Insights tab (ADD-3.3, Kaan-confirmed): the cross-interview
  // key findings (ranked pains) and automation opportunities now live on Home, their one
  // canonical surface. `workflowIds` gates the "see it in the workflow" deep-link so an
  // opportunity whose workflow is gone falls back to inline evidence, never a 404.
  keyFindings?: KeyFinding[];
  automation?: AutomationOpportunity[];
  workflowIds?: string[];
}) {
  const claimsById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const [openArea, setOpenArea] = useState<AreaContent | null>(null);
  // Evidence is demoted to a drill-down (3.2): the old competing right rail becomes a drawer
  // opened on demand from "What Nexus learned", so the reading column owns the page.
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const learned = cards.filter((c) => c.card_type === "learned");
  const areas = cards.filter((c) => c.card_type === "area_to_investigate");
  const people = cards.filter((c) => c.card_type === "suggested_person");
  const conflicts = cards.filter((c) => c.card_type === "conflict_point");

  // Evidence anchor: verbatim CEO-call quotes (his own words — A3). Dedup overlapping spans
  // so a fragment and the fuller quote that contains it never appear as two cards. Shown in
  // the evidence drill-down, not a competing column.
  const railEvidence = dedupeEvidenceByContainment(
    claims.filter((c) => c.evidence_ts && !c.is_paraphrased),
  ).slice(0, 3);

  const cfg = workspace.config ?? {};
  const topTwo = (areas.slice(0, 2) as { content: AreaContent }[]).map((a) => a.content.title);
  const firstPerson = (people[0]?.content as SuggestedPersonContent | undefined)?.name;

  // Real counts for the one-glance story. Records = interview/context claims (SCRAPED are
  // reference weight, not the transcript record — same split the empty state uses).
  const recordsCompiled = claims.filter((c) => c.tag !== "SCRAPED").length;
  const glanceStats = [
    { key: "records", label: "records compiled", value: recordsCompiled },
    { key: "people", label: "people identified", value: people.length },
    { key: "workflows", label: "workflows detected", value: workflowCount },
    { key: "open", label: "open questions", value: areas.length },
    { key: "gaps", label: "perception gaps", value: conflicts.length },
  ].filter((s) => s.value > 0);

  // "Awaiting your approval" for the attention block: plans that reached NEXUS_CHECK (the
  // human gate) and need the admin before they can send. Real plan state, never assumed.
  const awaitingApproval = Object.values(personPlans).filter((p) => p.state === "NEXUS_CHECK");

  return (
    <>
      {/* Reader-first single column (3.2): one story, big hierarchy, plain-language headers.
          The old competing evidence rail is gone — evidence lives in a drill-down drawer. */}
      <div className="mx-auto max-w-4xl px-8 py-10">
        {/* Header — identity + a plain subhead; Export stays a quiet secondary button. */}
        <motion.div variants={rise} initial="hidden" animate="show">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">
                Company Snapshot
              </h1>
              <p className="mt-2 max-w-xl leading-relaxed text-ink-soft">
                What {brand.product_name} understands about {workspace.name} so far.
              </p>
            </div>
            {/* ANYTIME-CONTEXT: add more context any time (primary) sits beside Export (quiet
                secondary). Only where the context-call beta is enabled — the mint 403s otherwise. */}
            <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
              {workspace.config?.beta_context_call && (
                <AddMoreContextButton workspaceId={workspace.id} />
              )}
              <ExportReportButton workspaceId={workspace.id} workspaceSlug={workspace.slug} />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-display text-lg leading-none text-ink shadow-elev-1 ring-1 ring-inset ring-white/40">
              {workspace.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
            </div>
            <div>
              <div className="font-display text-2xl text-ink">{workspace.name}</div>
              {cfg.founder && (
                <div className="text-sm text-ink-soft">
                  Meeting Owner: {cfg.founder}
                  {cfg.founder_role &&
                    cfg.founder_role.trim().toLowerCase() !==
                      cfg.founder.trim().toLowerCase() &&
                    ` (${cfg.founder_role})`}
                </div>
              )}
              {cfg.source && <div className="text-sm text-ink-faint">Source: {cfg.source}</div>}
            </div>
          </div>
        </motion.div>

        {/* (a) THE STORY SO FAR — one glance, real counts only. */}
        {glanceStats.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
              The story so far
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              {glanceStats.map((s) => (
                <div key={s.key}>
                  <div className="font-display text-3xl leading-none text-ink tabular">{s.value}</div>
                  <div className="mt-1 text-xs text-ink-faint">{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* (c) YOUR NEXT MOVE — the single prominent recommendation, up top (was buried). */}
        {topTwo.length > 0 && (
          <div className="card-hairline mt-8 flex flex-wrap items-center gap-4 rounded-card border border-accent/25 bg-accent-soft p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-elev-2 ring-1 ring-inset ring-white/25">
              <Rocket className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">
                Your next move
              </div>
              <p className="text-sm leading-relaxed text-ink">
                Investigate {topTwo.join(" and ")}.
                {firstPerson && ` Start with ${firstPerson}.`}
              </p>
            </div>
            <a
              href={`/w/${workspace.slug}/interviews`}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
            >
              View interview plans <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>
        )}

        {/* (b) NEEDS YOUR ATTENTION — approvals waiting on you + the open questions to dig
            into, each with an obvious action. */}
        {(awaitingApproval.length > 0 || areas.length > 0) && (
          <Section title="Needs your attention" count={areas.length}>
            {awaitingApproval.length > 0 && (
              <a
                href={`/w/${workspace.slug}/interviews`}
                className="lift mb-4 flex items-center gap-3 rounded-card border border-accent/30 bg-accent-soft p-4"
              >
                <ClipboardCheck className="h-5 w-5 shrink-0 text-accent-ink" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {awaitingApproval.length} interview{" "}
                  {awaitingApproval.length === 1 ? "plan is" : "plans are"} awaiting your approval
                  before they can be sent.
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                  Review <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              </a>
            )}
            {areas.length > 0 && (
              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {areas.map((card, i) => {
                  const a = card.content as AreaContent;
                  return (
                    <motion.button
                      key={card.id}
                      variants={rise}
                      onClick={() => setOpenArea(a)}
                      className="lift group flex flex-col rounded-card border border-line bg-surface p-4 text-left hover:border-line-strong"
                    >
                      <div className="flex items-start gap-2">
                        {/* Contiguous display position (1..n) — the record's own rank can be
                            sparse/non-sequential and reads as a leaked index in the grid. */}
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold tabular text-on-accent shadow-elev-1">
                          {i + 1}
                        </span>
                        <h3 className="font-semibold leading-snug text-ink">{a.title}</h3>
                      </div>
                      <div className="mt-3">
                        <PainBandChip band={a.pain_band} />
                      </div>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
                        {a.summary}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-all duration-150 ease-standard group-hover:gap-1.5">
                        Look into this <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </Section>
        )}

        {/* Perception gaps — first-class (A3), report-only. Kept compact; few and high-signal,
            so a single confidence badge stays (not the per-card noise Kaan named). */}
        {conflicts.length > 0 && (
          <Section title="Perception gaps" count={conflicts.length} accent>
            <div className="space-y-3">
              {conflicts.map((card) => {
                const cf = card.content as ConflictContent;
                return (
                  <article
                    key={card.id}
                    className="card-hairline rounded-card border border-accent/25 bg-accent-soft p-5"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-display text-lg text-ink">{cf.title}</h3>
                      <ConfidenceBadge confidence={card.confidence} context="Trust" />
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">{cf.note}</p>
                  </article>
                );
              })}
            </div>
          </Section>
        )}

        {/* Key findings — the pains the interviews weigh most (folded from the retired
            Insights tab, ADD-3.3). Cross-interview intelligence lives on Home now. */}
        {keyFindings.length > 0 && (
          <Section title="Key findings" count={keyFindings.length}>
            <p className="mb-5 max-w-2xl text-sm text-ink-soft">
              The pains the interviews put weight on, ranked by how much they hurt.
            </p>
            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {keyFindings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </motion.div>
          </Section>
        )}

        {/* Automation opportunities — where the records show manual/repetitive work
            (folded from Insights). Each deep-links to its workflow (?highlight=) when one
            resolves; otherwise it shows its evidence inline, never a link into the void. */}
        {automation.length > 0 && (
          <Section title="Automation opportunities" count={automation.length}>
            <p className="mb-5 max-w-2xl text-sm text-ink-soft">
              Places the records show manual, repetitive, or tool-hopping work. Each cites the
              records it rests on; the time figures are estimates built from stated
              assumptions, not measurements.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {automation.map((o) => (
                <OpportunityCard
                  key={o.id}
                  o={o}
                  slug={workspace.slug}
                  workflowIds={workflowIds}
                  claimsById={claimsById}
                />
              ))}
            </div>
          </Section>
        )}

        {/* (d) PEOPLE TO INTERVIEW — the roster, demoted below the urgent items. */}
        {people.length > 0 && (
          <Section title="People to interview" count={people.length}>
            <div className="card-hairline divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {people.map((card) => {
                const p = card.content as SuggestedPersonContent;
                const existing = personPlans[(p.name ?? "").trim().toLowerCase()];
                return (
                  <PersonRow
                    key={card.id}
                    person={p}
                    action={
                      existing ? (
                        // A plan already exists — show its real state, never a stale
                        // "Generate plan" (a second plan is still possible from Plans).
                        <Link
                          href={`/w/${workspace.slug}/plans/${existing.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                        >
                          <PlanStateChip state={existing.state as PlanState} />
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                      ) : (
                        <GeneratePlanButton
                          workspaceId={workspace.id}
                          slug={workspace.slug}
                          person={p}
                        />
                      )
                    }
                  />
                );
              })}
            </div>
          </Section>
        )}

        {/* (d) WHAT NEXUS LEARNED — clean statements, NO per-card trust chip (the noise).
            Trust + evidence stay one click away in the Sources & evidence drawer. */}
        {learned.length > 0 && (
          <Section title={`What ${brand.product_name} learned`} count={learned.length}>
            <div className="card-hairline divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {learned.map((card) => {
                const c = card.content as LearnedContent;
                const topic = c.evidence_claim_ids
                  .map((id) => claimsById.get(id)?.topic)
                  .find((t): t is ClaimTopic => Boolean(t));
                const meta = topic ? TOPIC_META[topic] : NEUTRAL_TOPIC;
                const TopicIcon = meta.icon;
                return (
                  <div key={card.id} className="flex items-start gap-3 p-4">
                    <TopicIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" strokeWidth={1.75} />
                    <p className="text-sm leading-snug text-ink">{c.title}</p>
                  </div>
                );
              })}
            </div>
            {railEvidence.length > 0 && (
              <button
                onClick={() => setEvidenceOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <Quote className="h-3.5 w-3.5" strokeWidth={1.75} /> Sources &amp; evidence
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </Section>
        )}

        {/* Trust Center discoverability (Kaan-approved proposal 6): quiet, where findings live. */}
        <p className="mt-10 text-xs text-ink-faint">
          Everything above is built under strict handling rules:{" "}
          <a
            href={`/w/${workspace.slug}/trust`}
            className="text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            how your people&apos;s words are handled
          </a>
          .
        </p>
      </div>

      <AreaDrawer area={openArea} claimsById={claimsById} slug={workspace.slug} onClose={() => setOpenArea(null)} />
      <EvidenceDrawer
        open={evidenceOpen}
        evidence={railEvidence}
        slug={workspace.slug}
        onClose={() => setEvidenceOpen(false)}
      />
    </>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count?: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-baseline gap-3">
        <h2
          className={
            "font-display text-[1.75rem] leading-tight " +
            (accent ? "text-accent-ink" : "text-ink")
          }
        >
          {title}
        </h2>
        {count != null && count > 0 && (
          <span className="tabular rounded-chip bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-ink/[0.04]">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// Areas-to-Investigate drawer (A3 + stage5-snapshot-small): the flagship V2 glass
// surface. Admin-only marker + status, pain band (never a decimal), qualitative
// pain signals, beliefs with confidence, evidence, unknowns, who holds the
// knowledge, and Add-to-Plan. Spring slide-in; sections cascade once settled.
function AreaDrawer({
  area,
  claimsById,
  slug,
  onClose,
}: {
  area: AreaContent | null;
  claimsById: Map<string, ClaimRecord>;
  slug: string;
  onClose: () => void;
}) {
  useEscapeClose(area !== null, onClose);
  // "Add to Interview Plan" → the K3 assign flow, pre-seeded: the person who holds this
  // knowledge (when known) as name/role, and the open question + its unknowns as the
  // required focus. AssignInterviewFlow reads ?name/role/focus (ADD-4.1). Gate is untouched.
  const planHref = area
    ? `/w/${slug}/interviews/new?${new URLSearchParams({
        ...(area.who_holds?.name ? { name: area.who_holds.name } : {}),
        ...(area.who_holds?.role ? { role: area.who_holds.role } : {}),
        focus: area.what_we_dont_know.length
          ? `Investigate "${area.title}". Open questions: ${area.what_we_dont_know.join("; ")}`
          : `Investigate "${area.title}".`,
      }).toString()}`
    : "#";
  return (
    <AnimatePresence>
      {area && (
        <>
          <motion.div
            variants={scrimFade}
            initial="hidden"
            animate="show"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={drawerSpring}
            className="glass fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l shadow-elev-3"
          >
            <div className="flex flex-col p-6">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl leading-snug text-ink">{area.title}</h2>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>

              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                transition={{ delayChildren: 0.12 }}
              >
                <motion.div
                  variants={drawerSection}
                  className="mb-4 flex items-center justify-between text-xs"
                >
                  {area.admin_only && (
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> visible to admins only
                    </span>
                  )}
                  <span className="rounded-chip bg-surface-sunken px-2.5 py-0.5 font-medium capitalize text-ink-soft ring-1 ring-inset ring-ink/[0.04]">
                    {area.status}
                  </span>
                </motion.div>

                {/* Pain band (coarse — never a decimal, F28/A2) */}
                <motion.div
                  variants={drawerSection}
                  className="mb-4 flex items-center gap-2"
                >
                  <span className="text-sm text-ink-soft">Pain level</span>
                  <PainBandChip band={area.pain_band} />
                </motion.div>

                {/* Pain signals — qualitative, no decimals */}
                <motion.div variants={drawerSection} className="mb-5 grid grid-cols-3 gap-2">
                  <SignalStat label="Frequency" value={area.signals.frequency} />
                  <SignalStat label="Emotional weight" value={area.signals.emotional_weight} />
                  <SignalStat label="Mentions" value={area.signals.mentions} />
                </motion.div>

                <motion.div variants={drawerSection}>
                  <DrawerBlock title="Why ranked here">
                    <p className="text-sm leading-relaxed text-ink-soft">{area.why_ranked}</p>
                  </DrawerBlock>
                </motion.div>

                <motion.div variants={drawerSection}>
                  <DrawerBlock title="What we believe so far">
                    <ul className="space-y-2">
                      {area.beliefs.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 text-sm text-ink-soft"
                        >
                          <span>{b.text}</span>
                          <ConfidenceBadge confidence={b.confidence} context="Trust" className="shrink-0" />
                        </li>
                      ))}
                    </ul>
                  </DrawerBlock>
                </motion.div>

                {area.evidence_claim_ids.length > 0 && (
                  <motion.div variants={drawerSection}>
                    <DrawerBlock title="Evidence">
                      <div className="space-y-3">
                        {area.evidence_claim_ids
                          .map((id) => claimsById.get(id))
                          .filter((c): c is ClaimRecord => Boolean(c))
                          .map((c) => (
                            <EvidenceQuoteCard
                              key={c.id}
                              claim={c}
                              sourceLabel="CEO Call"
                              showLink={false}
                            />
                          ))}
                      </div>
                    </DrawerBlock>
                  </motion.div>
                )}

                <motion.div variants={drawerSection}>
                  <DrawerBlock title="What we don't know yet">
                    <ul className="space-y-2">
                      {area.what_we_dont_know.map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm text-ink-soft">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border border-accent" />
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </DrawerBlock>
                </motion.div>

                {area.who_holds && (
                  <motion.div variants={drawerSection}>
                    <DrawerBlock title="Who holds this knowledge">
                      <div className="card-hairline rounded-card border border-line bg-surface">
                        <PersonRow person={area.who_holds} />
                      </div>
                    </DrawerBlock>
                  </motion.div>
                )}
              </motion.div>

              <div className="mt-6 flex flex-col gap-2 pt-2">
                {/* Real action now (ADD-5): opens the assign flow with this open question as
                    the focus + the knowledge-holder pre-filled. No longer a dead promise. */}
                <Link
                  href={planHref}
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
                >
                  Add to Interview Plan <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <p className="text-center text-xs text-ink-faint">
                  will create objectives from the unknowns above
                </p>
                {/* Two dead affordances removed here (ADD-5, Kaan's dead-button ask):
                    "View full transcript" (snapshot areas come from the CEO context call,
                    which has no clean transcript route yet — evidence is in the Sources &
                    evidence drawer) and "Add context (chat)" (a no-op that LOOKED live). The
                    #20 chat lane re-adds a real add-context action when the chat agent lands. */}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Sources & evidence drill-down (3.2): the old competing right rail is demoted to an
// on-demand drawer opened from "What Nexus learned". Same EvidenceQuoteCard, same verbatim
// trust anchor (A3) — just no longer fighting the reading column for the eye.
function EvidenceDrawer({
  open,
  evidence,
  slug,
  onClose,
}: {
  open: boolean;
  evidence: ClaimRecord[];
  slug: string;
  onClose: () => void;
}) {
  useEscapeClose(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={scrimFade}
            initial="hidden"
            animate="show"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={drawerSpring}
            className="glass fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l shadow-elev-3"
          >
            <div className="flex flex-col p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-snug text-ink">Sources &amp; evidence</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    Verbatim quotes from the context call, the trust anchor under everything on
                    this page.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="space-y-3">
                {evidence.map((claim) => (
                  <EvidenceQuoteCard
                    key={claim.id}
                    claim={claim}
                    sourceLabel="CEO Call"
                    contextHref={`/w/${slug}/context`}
                  />
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Qualitative pain signal (frequency / emotional weight / mentions). Elevated well —
// the value is the signal; no invented proportion bar (values are qualitative, F28/A2).
function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-hairline rounded-md border border-line bg-surface p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-tight text-ink">{value}</div>
    </div>
  );
}

function DrawerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Key finding card (folded from InsightsView, ADD-3.3): a pain the interviews weigh, with
// its band, role-quarantined attribution, and mention count. Rendering only — the record
// is never touched (tags never upgrade).
function FindingCard({ finding: f }: { finding: KeyFinding }) {
  return (
    <motion.article
      variants={rise}
      className="lift flex flex-col rounded-card border border-line bg-surface p-4 hover:border-line-strong"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
          <Flame className="h-3.5 w-3.5 text-accent/70" strokeWidth={1.75} />
          Pain point
        </span>
        {f.band && <PainBandChip band={f.band} />}
      </div>
      <p className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-ink">{f.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        {(() => {
          const who = attributionLabel(f.speaker, f.role, f.name_released);
          return who ? <span className="font-medium text-ink-soft">{who}</span> : null;
        })()}
        {f.mention_count > 1 && <span className="tabular">mentioned {f.mention_count} times</span>}
      </div>
    </motion.article>
  );
}

// Automation opportunity card (folded from InsightsView, ADD-3.3): manual/repetitive work
// the records show, with an honest ROI ESTIMATE (dashed, labeled — never like verified
// data) and a deep-link to its workflow when one resolves (?highlight= the steps); else it
// shows its evidence inline, never a link into the void (Kaan P1). The workflow guard rides
// in via workflowIds so the behavior is identical to the retired Insights tab.
function OpportunityCard({
  o,
  slug,
  workflowIds,
  claimsById,
}: {
  o: AutomationOpportunity;
  slug: string;
  workflowIds: string[];
  claimsById: Map<string, ClaimRecord>;
}) {
  return (
    <article className="card-hairline flex flex-col rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-ink">{o.title}</h3>
        <span className="shrink-0 rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-faint ring-1 ring-inset ring-ink/[0.04]">
          {o.claim_ids.length} record{o.claim_ids.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{o.summary}</p>
      {o.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {o.signals.map((sg) => (
            <span key={sg} className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
              {sg.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
      {o.roi && (
        <div className="mt-3 rounded-lg border border-dashed border-line-strong bg-surface-sunken/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
            <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} /> Estimate, not a measurement
          </div>
          {o.roi.low_hours_month != null && o.roi.high_hours_month != null && (
            <div className="mt-1 text-sm font-semibold text-ink">
              About {o.roi.low_hours_month} to {o.roi.high_hours_month} hours a month
            </div>
          )}
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{o.roi.assumption}</p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {o.roi.duration_claim_ids.length > 0
              ? `Durations come from ${o.roi.duration_claim_ids.length} captured record${o.roi.duration_claim_ids.length === 1 ? "" : "s"}.`
              : "The duration itself is an assumption, not captured data."}
          </p>
        </div>
      )}
      {o.workflow_id && workflowIds.includes(o.workflow_id) ? (
        <Link
          href={`/w/${slug}/workflow/${o.workflow_id}?from=home${o.step_ids.length ? `&highlight=${o.step_ids.join(",")}` : ""}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
        >
          See it in the workflow <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-accent hover:text-accent-hover">
            See the evidence ({o.claim_ids.length} record{o.claim_ids.length === 1 ? "" : "s"})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {o.claim_ids.map((cid) => {
              const c = claimsById.get(cid);
              if (!c) return null;
              return (
                <li key={cid} className="rounded-md border border-line bg-surface-sunken/40 px-2.5 py-1.5 text-xs leading-relaxed text-ink-soft">
                  {c.claim_text}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            No mapped workflow holds these steps yet.{" "}
            <Link href={`/w/${slug}/context`} className="font-medium text-accent-ink hover:underline">Add context</Link>{" "}
            or{" "}
            <Link href={`/w/${slug}/interviews/new`} className="font-medium text-accent-ink hover:underline">schedule an interview</Link>{" "}
            to map it.
          </p>
        </details>
      )}
    </article>
  );
}
