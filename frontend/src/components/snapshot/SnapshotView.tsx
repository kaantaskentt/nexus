"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, Lock, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import type {
  AreaContent,
  ClaimRecord,
  ClaimTopic,
  ConflictContent,
  LearnedContent,
  PlanState,
  SnapshotCard,
  SuggestedPersonContent,
  Workspace,
} from "@/lib/types";
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

export function SnapshotView({
  workspace,
  cards,
  claims,
  personPlans = {},
}: {
  workspace: Workspace;
  cards: SnapshotCard[];
  claims: ClaimRecord[];
  // Latest plan per suggested person (folded name → {id, state}), resolved server-side
  // so the row shows the REAL lifecycle instead of a stale "Generate plan" (Emre P2).
  personPlans?: Record<string, { id: string; state: string }>;
}) {
  const claimsById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const [openArea, setOpenArea] = useState<AreaContent | null>(null);

  const learned = cards.filter((c) => c.card_type === "learned");
  const areas = cards.filter((c) => c.card_type === "area_to_investigate");
  const people = cards.filter((c) => c.card_type === "suggested_person");
  const conflicts = cards.filter((c) => c.card_type === "conflict_point");

  // Evidence rail: verbatim CEO-call quotes are the trust anchor (his own words — A3).
  // Dedup overlapping spans before taking the top 3 so a fragment and the fuller quote
  // that contains it never appear as two cards.
  const railEvidence = dedupeEvidenceByContainment(
    claims.filter((c) => c.evidence_ts && !c.is_paraphrased),
  ).slice(0, 3);

  const cfg = workspace.config ?? {};
  const topTwo = (areas.slice(0, 2) as { content: AreaContent }[]).map((a) => a.content.title);
  const firstPerson = (people[0]?.content as SuggestedPersonContent | undefined)?.name;

  return (
    <>
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_19rem]">
          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0">
            <motion.div variants={rise} initial="hidden" animate="show">
              {/* F2: the one-button report export lives beside the title — the snapshot
                  IS the report's source, so this is where an admin looks for it. */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">
                  Company Snapshot
                </h1>
                <ExportReportButton workspaceId={workspace.id} workspaceSlug={workspace.slug} />
              </div>

              {/* Company identity */}
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
                  {cfg.source && (
                    <div className="text-sm text-ink-faint">Source: {cfg.source}</div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Overview — what the context call established (learned cards). Category
                vocabulary shared with SnapshotIntro so intro and snapshot speak one language. */}
            <Section title="Overview" count={learned.length}>
              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {learned.map((card) => {
                  const c = card.content as LearnedContent;
                  const topic = c.evidence_claim_ids
                    .map((id) => claimsById.get(id)?.topic)
                    .find((t): t is ClaimTopic => Boolean(t));
                  const meta = topic ? TOPIC_META[topic] : NEUTRAL_TOPIC;
                  const TopicIcon = meta.icon;
                  return (
                    <motion.article
                      key={card.id}
                      variants={rise}
                      className="lift flex flex-col gap-3 rounded-card border border-line bg-surface p-4 hover:border-line-strong"
                    >
                      <h3 className="text-[0.95rem] font-semibold leading-snug text-ink">
                        {c.title}
                      </h3>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                          <TopicIcon className="h-3.5 w-3.5 text-accent/70" strokeWidth={1.75} />
                          {meta.label}
                        </span>
                        <ConfidenceBadge confidence={card.confidence} context="Trust" />
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            </Section>

            {/* Teams & People — who actually does the work, and who to interview next
                (suggested_person cards). Regrouped up under Overview to match the intro order. */}
            <Section title="Teams & People" count={people.length}>
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

            {/* Perception gaps — first-class (A3), shown once contradictions exist. Same
                conflict_point cards, under the glossary term for conflicts. */}
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

            {/* Open questions — the areas worth digging into next (area_to_investigate cards;
                plan §3 maps areas to open questions). Same clickable cards + AreaDrawer. */}
            <Section title="Open questions" count={areas.length}>
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
                        Open <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </Section>

            {/* Next Recommended Action */}
            {topTwo.length > 0 && (
              <div className="card-hairline mt-8 flex flex-wrap items-center gap-4 rounded-card border border-accent/25 bg-accent-soft p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-elev-2 ring-1 ring-inset ring-white/25">
                  <Rocket className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">
                    Next Recommended Action
                  </div>
                  {/* "Start Active Run" promised orchestration that doesn't exist yet
                      (Emre doc-2 P2, Kaan ruling July 8: rename until the machinery
                      ships). The recommendation stands; the button says what it does. */}
                  <p className="text-sm leading-relaxed text-ink">
                    Next: investigate {topTwo.join(" and ")}.
                    {firstPerson && ` First interview: ${firstPerson}.`}
                  </p>
                </div>
                <a
                  href={`/w/${workspace.slug}/plans`}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
                >
                  View plans <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </a>
              </div>
            )}

            {/* Trust Center discoverability (Kaan-approved proposal 6): the product's
                best trust asset, linked where the findings live, not only in the
                sidebar footer. Quiet by design. */}
            <p className="mt-6 text-xs text-ink-faint">
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

          {/* ── Evidence rail ───────────────────────────────────────── */}
          <aside className="lg:pt-2">
            <div className="sticky top-24">
              <h2 className="mb-4 font-display text-xl text-ink">Evidence</h2>
              {/* soft top fade so the rail reads as a rail, not a column */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-canvas to-transparent" />
                <div className="space-y-3">
                  {railEvidence.map((claim) => (
                    <EvidenceQuoteCard
                      key={claim.id}
                      claim={claim}
                      sourceLabel="CEO Call"
                      contextHref={`/w/${workspace.slug}/context`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AreaDrawer area={openArea} claimsById={claimsById} onClose={() => setOpenArea(null)} />
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
  onClose,
}: {
  area: AreaContent | null;
  claimsById: Map<string, ClaimRecord>;
  onClose: () => void;
}) {
  useEscapeClose(area !== null, onClose);
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
                <button
                  disabled
                  title="Creating an interview plan from an area is being wired in this build"
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-faint opacity-60"
                >
                  Add to Interview Plan <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
                <p className="text-center text-xs text-ink-faint">
                  will create objectives from the unknowns above
                </p>
                <div className="flex items-center justify-center gap-4 pt-1 text-xs font-medium">
                  <button
                    disabled
                    title="Transcript view ships in the next build"
                    className="cursor-not-allowed text-ink-faint opacity-60"
                  >
                    View full transcript
                  </button>
                  {/* Add context is the #20 chat entry point — wired live as the chat agent lands. */}
                  <button className="text-accent hover:underline">
                    Add context (chat with {brand.product_name})
                  </button>
                </div>
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
