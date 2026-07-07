"use client";

import { motion } from "framer-motion";
import { GitCompareArrows, Flame, Target } from "lucide-react";
import type {
  Admission,
  ConflictSide,
  InsightConflict,
  InsightsData,
  KeyFinding,
} from "@/lib/types";
import { ConfidenceBadge, PainBandChip } from "@/components";
import { confidenceForTag } from "@/lib/trust";
import { conflictKindMeta } from "@/lib/conflicts";
import { rise, staggerParent } from "@/lib/variants";
import brand from "@/lib/brand";

function capitalize(s: string) {
  return s.replace(/^\w/, (c) => c.toUpperCase());
}

// Pain findings and open questions attribute by ROLE by default (reflect-back-close
// Beat 3, hard-rule 8): the respondent's name is quarantined at this render surface
// unless they explicitly released it. Returns the label to show, or null when there's
// nothing safe to render (no role and no released name).
function attributionLabel(
  speaker: string | null,
  role: string | null,
  released?: boolean,
): string | null {
  if (released && speaker) return role ? `${speaker} · ${role}` : speaker;
  return role;
}

export function InsightsView({ data }: { data: InsightsData }) {
  const { conflicts, key_findings, admissions, stats } = data;
  const nothing = conflicts.length === 0 && key_findings.length === 0 && admissions.length === 0;

  // The flagship "Perception gaps" number must match the story on the page: a
  // leadership-vs-floor conflict IS the classic perception gap (collision-detector.md).
  // The backend gaps count can lag the labeled conflicts, so surface whichever is larger
  // rather than show a "0" beside a visible leadership/floor gap.
  const gapConflicts = conflicts.filter(
    (c) => c.kind === "ceo_vs_floor" || c.kind === "perception_gap",
  ).length;
  const gapCount = Math.max(stats.gaps, gapConflicts);

  return (
    <>
      <div className="mx-auto max-w-5xl px-8 py-10">
        <motion.div variants={rise} initial="hidden" animate="show">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Insights</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
            What the interviews agree on, and where they do not. {brand.product_name} surfaces
            contradictions by comparing records across people and rounds. It never edits a
            record to resolve one.
          </p>
        </motion.div>

        {nothing ? (
          <EmptyInsights />
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Interviews" value={stats.interviews} />
              <Stat label="Records" value={stats.records} />
              <Stat label="Conflicts" value={stats.conflicts} accent={stats.conflicts > 0} />
              <Stat label="Perception gaps" value={gapCount} accent={gapCount > 0} />
            </div>

            {conflicts.length > 0 && (
              <Section
                title="Conflict Points"
                count={conflicts.length}
                accent
                blurb="Two records that do not line up. Both are kept; the disagreement is the signal."
              >
                <motion.div
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {conflicts.map((c) => (
                    <ConflictCard key={c.id} conflict={c} />
                  ))}
                </motion.div>
              </Section>
            )}

            {key_findings.length > 0 && (
              <Section
                title="Key Findings"
                count={key_findings.length}
                blurb="The pains the interviews put weight on, ranked by how much they hurt."
              >
                <motion.div
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  {key_findings.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </motion.div>
              </Section>
            )}

            {admissions.length > 0 && (
              <Section
                title="Open Questions"
                count={admissions.length}
                blurb="Where an honest not-sure came up. Each one seeds a question for the next round."
              >
                <div className="card-hairline divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {admissions.map((a) => (
                    <AdmissionRow key={a.id} admission={a} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card-hairline rounded-card border border-line bg-surface p-4">
      <div className={`tabular font-display text-3xl leading-none ${accent ? "text-accent-ink" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.06em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

// A conflict as two accounts placed side by side — who said each, its trust tag, and the
// claim. The point is legibility of the disagreement, so neither side is styled as "right".
function ConflictCard({ conflict: c }: { conflict: InsightConflict }) {
  const meta = conflictKindMeta(c.kind);
  return (
    <motion.article
      variants={rise}
      className="card-hairline rounded-card border border-accent/25 bg-accent-soft/60 p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-accent-ink ring-1 ring-inset ring-accent/20">
          <GitCompareArrows className="h-3.5 w-3.5" strokeWidth={2} />
          {meta.label}
        </span>
        <span className="text-xs font-medium capitalize text-ink-faint">
          {c.status === "resolved" ? "Resolved" : "Open"}
        </span>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ConflictSideBlock side={c.a} />
        <div className="flex items-center justify-center">
          <span className="rounded-chip bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint shadow-elev-1 sm:rotate-0">
            and
          </span>
        </div>
        <ConflictSideBlock side={c.b} />
      </div>

      {c.note && (
        <p className="mt-4 border-t border-accent/15 pt-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-accent-ink">What differs: </span>
          {c.note}
        </p>
      )}
    </motion.article>
  );
}

function ConflictSideBlock({ side }: { side: ConflictSide }) {
  return (
    <div className="card-hairline flex flex-col rounded-md border border-line bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">
          {side.speaker ? (
            <>
              <span className="font-medium text-ink">{side.speaker}</span>
              {side.role && <span className="text-ink-faint"> · {side.role}</span>}
            </>
          ) : (
            <span className="text-ink-faint">Unattributed</span>
          )}
        </span>
        {side.tag && <ConfidenceBadge confidence={confidenceForTag(side.tag)} className="shrink-0" />}
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">{side.text}</p>
    </div>
  );
}

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

function AdmissionRow({ admission: a }: { admission: Admission }) {
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink">{a.text}</p>
        {(() => {
          const who = attributionLabel(a.speaker, a.role, a.name_released);
          return who ? (
            <p className="mt-1 text-xs text-ink-faint">
              <span className="font-medium text-ink-soft">{who}</span>
            </p>
          ) : null;
        })()}
      </div>
      {a.objective && (
        <div className="flex items-start gap-1.5 rounded-md bg-accent-soft px-3 py-2 sm:max-w-[16rem]">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
          <span className="text-xs leading-snug text-accent-ink">
            <span className="font-semibold">Next round: </span>
            {capitalize(a.objective)}
          </span>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  blurb,
  children,
}: {
  title: string;
  count?: number;
  accent?: boolean;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-1 flex items-baseline gap-3">
        <h2 className={`font-display text-[1.75rem] leading-tight ${accent ? "text-accent-ink" : "text-ink"}`}>
          {title}
        </h2>
        {count != null && count > 0 && (
          <span className="tabular rounded-chip bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-ink/[0.04]">
            {count}
          </span>
        )}
      </div>
      {blurb && <p className="mb-5 text-sm text-ink-soft">{blurb}</p>}
      {children}
    </section>
  );
}

function EmptyInsights() {
  return (
    <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
      <GitCompareArrows className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
      <p className="mt-4 font-display text-xl text-ink">No cross-interview signal yet</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Conflicts, findings, and follow-ups appear once a second interview gives
        {" "}{brand.product_name} records to compare. Run another interview to fill this in.
      </p>
    </div>
  );
}
