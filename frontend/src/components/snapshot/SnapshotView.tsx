"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone,
  User,
  MessageCircle,
  Globe,
  Rocket,
  Lock,
  ArrowRight,
  X,
} from "lucide-react";
import type {
  AreaContent,
  ClaimRecord,
  ConflictContent,
  LearnedContent,
  LearnedSource,
  SnapshotCard,
  SuggestedPersonContent,
  Workspace,
} from "@/lib/types";
import {
  AppShell,
  ConfidenceBadge,
  EvidenceQuoteCard,
  PainBandChip,
  PersonRow,
} from "@/components";
import { rise, staggerParent, drawerSpring, scrimFade, drawerSection } from "@/lib/variants";
import brand from "@/lib/brand";

const SOURCE_ICON: Record<LearnedSource, typeof Phone> = {
  call: Phone,
  person: User,
  message: MessageCircle,
  web: Globe,
  linkedin: Globe,
};

export function SnapshotView({
  workspace,
  cards,
  claims,
}: {
  workspace: Workspace;
  cards: SnapshotCard[];
  claims: ClaimRecord[];
}) {
  const claimsById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const [openArea, setOpenArea] = useState<AreaContent | null>(null);

  const learned = cards.filter((c) => c.card_type === "learned");
  const areas = cards.filter((c) => c.card_type === "area_to_investigate");
  const people = cards.filter((c) => c.card_type === "suggested_person");
  const conflicts = cards.filter((c) => c.card_type === "conflict_point");

  // Evidence rail: verbatim CEO-call quotes are the trust anchor (his own words — A3).
  const railEvidence = claims.filter((c) => c.evidence_ts && !c.is_paraphrased).slice(0, 3);

  const cfg = workspace.config ?? {};
  const topTwo = (areas.slice(0, 2) as { content: AreaContent }[]).map((a) => a.content.title);
  const firstPerson = (people[0]?.content as SuggestedPersonContent | undefined)?.name;

  return (
    <AppShell workspace={workspace} active="snapshot">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_19rem]">
          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0">
            <motion.div variants={rise} initial="hidden" animate="show">
              <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">
                Company Snapshot
              </h1>

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
                      {cfg.founder_role && ` (${cfg.founder_role})`}
                    </div>
                  )}
                  {cfg.source && (
                    <div className="text-sm text-ink-faint">Source: {cfg.source}</div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* What {brand} Learned */}
            <Section title={`What ${brand.product_name} Learned`}>
              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {learned.map((card) => {
                  const c = card.content as LearnedContent;
                  const Icon = SOURCE_ICON[c.source];
                  return (
                    <motion.article
                      key={card.id}
                      variants={rise}
                      className="lift flex flex-col rounded-card border border-line bg-surface p-4 hover:border-line-strong"
                    >
                      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink shadow-[inset_0_1px_2px_rgb(31_26_19/0.06)] ring-1 ring-inset ring-accent/10">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </div>
                      <h3 className="flex-1 text-sm font-semibold leading-snug text-ink">
                        {c.title}
                      </h3>
                      <div className="mt-4 flex items-center justify-between">
                        <ConfidenceBadge confidence={card.confidence} />
                        <SignalBars confidence={card.confidence} />
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            </Section>

            {/* Areas to Investigate */}
            <Section title="Areas to Investigate">
              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {areas.map((card) => {
                  const a = card.content as AreaContent;
                  return (
                    <motion.button
                      key={card.id}
                      variants={rise}
                      onClick={() => setOpenArea(a)}
                      className="lift group flex flex-col rounded-card border border-line bg-surface p-4 text-left hover:border-line-strong"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold tabular text-on-accent shadow-elev-1">
                          {a.rank}
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

            {/* Conflict Points — first-class (A3), shown once contradictions exist */}
            {conflicts.length > 0 && (
              <Section title="Conflict Points" accent>
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
                          <ConfidenceBadge confidence={card.confidence} />
                        </div>
                        <p className="text-sm leading-relaxed text-ink-soft">{cf.note}</p>
                      </article>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Suggested People to Interview */}
            <Section title="Suggested People to Interview">
              <div className="card-hairline divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {people.map((card) => {
                  const p = card.content as SuggestedPersonContent;
                  return (
                    <PersonRow
                      key={card.id}
                      person={p}
                      action={
                        <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink">
                          <User className="h-4 w-4" strokeWidth={1.75} />
                          Interview
                        </button>
                      }
                    />
                  );
                })}
              </div>
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
                  <p className="text-sm leading-relaxed text-ink">
                    Start Active Run: investigate {topTwo.join(" and ")}.
                    {firstPerson && ` First interview: ${firstPerson}.`}
                  </p>
                </div>
                <a
                  href={`/w/${workspace.slug}/plans`}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
                >
                  Start Active Run <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </a>
              </div>
            )}
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
                    <EvidenceQuoteCard key={claim.id} claim={claim} sourceLabel="CEO Call" />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AreaDrawer area={openArea} claimsById={claimsById} onClose={() => setOpenArea(null)} />
    </AppShell>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className={"mb-4 font-display text-2xl " + (accent ? "text-accent-ink" : "text-ink")}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// Signal-strength glyph echoing the mockup's ascending bars — taller/greener at
// higher confidence, muted at lower. Comprehension cue, not decoration.
function SignalBars({ confidence }: { confidence: string }) {
  const level =
    ({ verified: 3, high: 3, reported: 2, guess: 1, scraped: 1 } as Record<string, number>)[
      confidence
    ] ?? 1;
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3].map((b) => (
        <span
          key={b}
          className={
            "w-1 rounded-sm " +
            (b <= level ? "bg-success" : "bg-line-strong") +
            (b === 1 ? " h-1.5" : b === 2 ? " h-2.5" : " h-3.5")
          }
        />
      ))}
    </span>
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
                          <ConfidenceBadge confidence={b.confidence} className="shrink-0" />
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
                <button className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2">
                  Add to Interview Plan <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
                <p className="text-center text-xs text-ink-faint">
                  creates objectives from the unknowns above
                </p>
                <div className="flex items-center justify-center gap-4 pt-1 text-xs font-medium text-accent">
                  <button className="hover:underline">View full transcript</button>
                  <button className="hover:underline">
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
