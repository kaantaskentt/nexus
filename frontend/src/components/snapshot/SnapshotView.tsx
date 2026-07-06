"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  AreaContent,
  ClaimRecord,
  ConflictContent,
  LearnedContent,
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

// Entry motion for cards — comprehension only (A15.4): a gentle stagger so the eye
// lands section by section, never decoration.
const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
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
  const claimsById = useMemo(
    () => new Map(claims.map((c) => [c.id, c])),
    [claims],
  );
  const [openArea, setOpenArea] = useState<AreaContent | null>(null);

  const learned = cards.filter((c) => c.card_type === "learned");
  const areas = cards.filter((c) => c.card_type === "area_to_investigate");
  const people = cards.filter((c) => c.card_type === "suggested_person");
  const conflicts = cards.filter((c) => c.card_type === "conflict_point");

  // Evidence rail: verbatim CEO-call quotes with timestamps are the trust anchor
  // (his own words — A3). Paraphrased interview evidence lives inside each area.
  const railEvidence = claims
    .filter((c) => c.evidence_ts && !c.is_paraphrased)
    .slice(0, 4);

  return (
    <AppShell workspace={workspace} active="snapshot">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">Company Snapshot</h1>
          <p className="mt-1 text-sm text-ink-soft">
            What we&apos;ve learned so far, and where to look next. Updated after each
            completed interview round — never mid-interview.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0 space-y-10">
            {/* Learned */}
            <Section title="Learned" count={learned.length}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {learned.map((card, i) => {
                  const c = card.content as LearnedContent;
                  return (
                    <motion.article
                      key={card.id}
                      {...rise}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-card border border-line bg-surface p-5 shadow-card"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg leading-snug text-ink">
                          {c.title}
                        </h3>
                        <ConfidenceBadge confidence={card.confidence} />
                      </div>
                      <p className="text-sm leading-relaxed text-ink-soft">{c.body}</p>
                    </motion.article>
                  );
                })}
              </div>
            </Section>

            {/* Areas to Investigate */}
            <Section title="Areas to Investigate" count={areas.length}>
              <div className="space-y-3">
                {areas.map((card, i) => {
                  const a = card.content as AreaContent;
                  return (
                    <motion.button
                      key={card.id}
                      {...rise}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setOpenArea(a)}
                      className="flex w-full items-start justify-between gap-4 rounded-card border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-raised"
                    >
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <PainBandChip band={a.pain_band} />
                          <ConfidenceBadge confidence={card.confidence} />
                        </div>
                        <h3 className="font-display text-lg leading-snug text-ink">
                          {a.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-sm text-ink-soft">
                          {a.what_we_believe}
                        </p>
                      </div>
                      <span className="mt-1 shrink-0 text-sm text-ink-faint">
                        Open →
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </Section>

            {/* Conflict Points — first-class (A3) */}
            {conflicts.length > 0 && (
              <Section title="Conflict Points" count={conflicts.length} accent>
                <p className="-mt-2 mb-3 text-sm text-ink-soft">
                  Contradictions across sources — the meeting-worthy findings. Resolved
                  in the report; surfaced here as golden data for the next round.
                </p>
                <div className="space-y-3">
                  {conflicts.map((card, i) => {
                    const cf = card.content as ConflictContent;
                    return (
                      <motion.article
                        key={card.id}
                        {...rise}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-card border border-line-strong bg-accent-soft p-5"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="font-display text-lg text-ink">{cf.title}</h3>
                          <ConfidenceBadge confidence={card.confidence} />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <ConflictSide label={cf.claim_a.label} claim={claimsById.get(cf.claim_a.claim_id)} />
                          <ConflictSide label={cf.claim_b.label} claim={claimsById.get(cf.claim_b.claim_id)} />
                        </div>
                        <p className="mt-3 text-sm text-ink-soft">{cf.note}</p>
                      </motion.article>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Suggested People */}
            <Section title="Suggested People" count={people.length}>
              <div className="space-y-3">
                {people.map((card, i) => {
                  const p = card.content as SuggestedPersonContent;
                  return (
                    <motion.div key={card.id} {...rise} transition={{ delay: i * 0.04 }}>
                      <PersonRow
                        name={p.name}
                        role={p.role}
                        whyLine={p.why_line}
                        confidence={card.confidence}
                        action={
                          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft">
                            Add to plan
                          </button>
                        }
                      />
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* ── Evidence rail ───────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-10">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Evidence rail
              </div>
              <div className="space-y-3">
                {railEvidence.map((claim) => (
                  <EvidenceQuoteCard key={claim.id} claim={claim} />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                Founder-call quotes are verbatim with transcript timestamps. Employee
                evidence is paraphrased and shown inside each area.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <AreaDrawer
        area={openArea}
        claimsById={claimsById}
        onClose={() => setOpenArea(null)}
      />
    </AppShell>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className={"font-display text-xl " + (accent ? "text-accent-ink" : "text-ink")}>
          {title}
        </h2>
        <span className="rounded-chip bg-surface-raised px-2 py-0.5 text-xs text-ink-faint">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function ConflictSide({
  label,
  claim,
}: {
  label: string;
  claim?: ClaimRecord;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <p className="text-sm font-medium text-ink">{label}</p>
      {claim?.evidence_ts && (
        <p className="mt-1 text-xs text-ink-faint">
          {claim.is_paraphrased ? "Paraphrased · " : "Verbatim · "}
          {claim.evidence_ts}
        </p>
      )}
    </div>
  );
}

// Areas-to-Investigate sidebar (A3): why ranked here · what we believe · evidence ·
// what we don't know yet · actions (Add to Interview Plan / Add context).
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-y-auto border-l border-line bg-canvas p-6 shadow-card"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <PainBandChip band={area.pain_band} className="mb-2" />
                <h2 className="font-display text-2xl leading-snug text-ink">
                  {area.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg px-2 py-1 text-ink-faint hover:bg-surface-raised hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <DrawerBlock title="Why ranked here">
              <p className="text-sm leading-relaxed text-ink-soft">{area.why_ranked}</p>
            </DrawerBlock>

            <DrawerBlock title="What we believe so far">
              <p className="text-sm leading-relaxed text-ink-soft">
                {area.what_we_believe}
              </p>
            </DrawerBlock>

            <DrawerBlock title="Evidence">
              <div className="space-y-3">
                {area.evidence_claim_ids
                  .map((id) => claimsById.get(id))
                  .filter((c): c is ClaimRecord => Boolean(c))
                  .map((c) => (
                    <EvidenceQuoteCard key={c.id} claim={c} />
                  ))}
              </div>
            </DrawerBlock>

            <DrawerBlock title="What we don't know yet">
              <ul className="space-y-2">
                {area.what_we_dont_know.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-accent">?</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </DrawerBlock>

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90">
                Add to Interview Plan
              </button>
              <button className="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised">
                Add context (chat with Nexus)
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {title}
      </h3>
      {children}
    </div>
  );
}
