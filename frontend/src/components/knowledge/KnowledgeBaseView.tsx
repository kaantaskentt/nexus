"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, User, Layers, MessageSquareQuote } from "lucide-react";
import type {
  ClaimKind,
  ClaimTopic,
  Confidence,
  KnowledgeRecord,
} from "@/lib/types";
import { ConfidenceBadge, EvidenceQuoteCard } from "@/components";
import { topicMeta } from "@/lib/topics";
import { confidenceForTag } from "@/lib/trust";
import { rise } from "@/lib/variants";
import { cn } from "@/lib/cn";

// Canonical display order — pains first (the product hunts for them), vocabulary last.
const TOPIC_ORDER: ClaimTopic[] = [
  "pain", "process_step", "time_or_cost", "tool",
  "person", "company_fact", "success_criteria", "vocabulary",
];
// Trust tiers shown highest-first. A GUESS never gets its own tier — it renders as
// "Reported" everywhere (non-negotiable #1), so the facet folds it in.
const TRUST_ORDER: (Confidence | "untagged")[] = ["verified", "high", "reported", "scraped", "untagged"];
const TRUST_LABEL: Record<Confidence | "untagged", string> = {
  verified: "Verified", high: "High", reported: "Reported",
  guess: "Reported", scraped: "Scraped", untagged: "No trust tag",
};
// Records that carry no trust tag (directives/admissions/corrections) — their kind is
// the honest signal in place of a badge.
const KIND_LABEL: Record<ClaimKind, string> = {
  statement: "Statement", directive: "Directive",
  admission: "Admission", correction: "Correction",
};

function trustTier(r: KnowledgeRecord): Confidence | "untagged" {
  return r.tag ? confidenceForTag(r.tag) : "untagged";
}

function matchesPerson(r: KnowledgeRecord, name: string): boolean {
  return r.speaker_name === name || (r.subject_is_person && r.subject_name === name);
}

interface Filters {
  q: string;
  topic: ClaimTopic | "all";
  trust: Confidence | "untagged" | "all";
  person: string | "all";
  source: string | "all";
}

const EMPTY: Filters = { q: "", topic: "all", trust: "all", person: "all", source: "all" };

// Filter predicate. `skip` lets a facet count records as if its own selection were
// cleared, so the counts beside each option reflect real faceted results.
function keep(r: KnowledgeRecord, f: Filters, skip?: keyof Filters): boolean {
  if (skip !== "q" && f.q) {
    const hay = `${r.claim_text} ${r.evidence_quote ?? ""} ${r.speaker_name ?? ""} ${r.subject_name ?? ""}`.toLowerCase();
    if (!hay.includes(f.q.toLowerCase().trim())) return false;
  }
  if (skip !== "topic" && f.topic !== "all" && r.topic !== f.topic) return false;
  if (skip !== "trust" && f.trust !== "all" && trustTier(r) !== f.trust) return false;
  if (skip !== "person" && f.person !== "all" && !matchesPerson(r, f.person)) return false;
  if (skip !== "source" && f.source !== "all" && r.source_id !== f.source) return false;
  return true;
}

export function KnowledgeBaseView({ records }: { records: KnowledgeRecord[] }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  const filtered = useMemo(() => records.filter((r) => keep(r, f)), [records, f]);

  // Facet options with live counts (each computed against the other active filters).
  const facets = useMemo(() => {
    const count = (skip: keyof Filters, key: (r: KnowledgeRecord) => string | null) => {
      const m = new Map<string, number>();
      for (const r of records) {
        if (!keep(r, f, skip)) continue;
        const k = key(r);
        if (k != null) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const topicC = count("topic", (r) => r.topic);
    const trustC = count("trust", (r) => trustTier(r));
    // A person can be the speaker or the (person) subject — count each record once per name.
    const personC = new Map<string, number>();
    for (const r of records) {
      if (!keep(r, f, "person")) continue;
      const names: string[] = [];
      if (r.speaker_name) names.push(r.speaker_name);
      if (r.subject_is_person && r.subject_name && !names.includes(r.subject_name)) {
        names.push(r.subject_name);
      }
      for (const n of names) personC.set(n, (personC.get(n) ?? 0) + 1);
    }
    const sourceC = count("source", (r) => r.source_id);
    const sourceLabels = new Map(records.map((r) => [r.source_id, r.source_label]));

    return {
      topics: TOPIC_ORDER.filter((t) => topicC.has(t)).map((t) => ({ value: t, count: topicC.get(t)! })),
      trust: TRUST_ORDER.filter((t) => trustC.has(t)).map((t) => ({ value: t, count: trustC.get(t)! })),
      persons: Array.from(personC.entries()).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
      sources: Array.from(sourceC.entries()).sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count, label: sourceLabels.get(value) ?? "Source" })),
    };
  }, [records, f]);

  const activeCount = (["topic", "trust", "person", "source"] as const)
    .filter((k) => f[k] !== "all").length + (f.q ? 1 : 0);
  const sourceCount = new Set(records.map((r) => r.source_id)).size;

  return (
    <>
      <div className="mx-auto max-w-6xl px-8 py-10">
        <motion.div variants={rise} initial="hidden" animate="show">
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Company Context</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
            Every record extracted so far, with its trust tag and the words it came from.
            Truth emerges from comparing records, so nothing here is edited or merged.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-faint">
            <span className="tabular">
              <span className="font-semibold text-ink">{records.length}</span> records
            </span>
            <span className="tabular">
              <span className="font-semibold text-ink">{sourceCount}</span> sources
            </span>
          </div>
        </motion.div>

        {records.length === 0 ? (
          <EmptyStore />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[15rem_1fr]">
            {/* ── Filter rail ─────────────────────────────────────────── */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="relative mb-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
                <input
                  value={f.q}
                  onChange={(e) => set("q", e.target.value)}
                  placeholder="Search records"
                  className="input pl-9"
                  aria-label="Search records"
                />
              </div>

              <FacetGroup title="Topic">
                {facets.topics.map(({ value, count }) => {
                  const meta = topicMeta(value);
                  const Icon = meta.icon;
                  return (
                    <FacetButton
                      key={value}
                      active={f.topic === value}
                      count={count}
                      onClick={() => set("topic", f.topic === value ? "all" : value)}
                    >
                      <Icon className="h-3.5 w-3.5 text-accent/70" strokeWidth={1.75} />
                      {meta.label}
                    </FacetButton>
                  );
                })}
              </FacetGroup>

              <FacetGroup title="Trust">
                {facets.trust.map(({ value, count }) => (
                  <FacetButton
                    key={value}
                    active={f.trust === value}
                    count={count}
                    onClick={() => set("trust", f.trust === value ? "all" : value)}
                  >
                    {TRUST_LABEL[value]}
                  </FacetButton>
                ))}
              </FacetGroup>

              {facets.persons.length > 0 && (
                <FacetGroup title="Person">
                  {facets.persons.map(({ value, count }) => (
                    <FacetButton
                      key={value}
                      active={f.person === value}
                      count={count}
                      onClick={() => set("person", f.person === value ? "all" : value)}
                    >
                      <User className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                      {value}
                    </FacetButton>
                  ))}
                </FacetGroup>
              )}

              {facets.sources.length > 1 && (
                <FacetGroup title="Source">
                  {facets.sources.map(({ value, count, label }) => (
                    <FacetButton
                      key={value}
                      active={f.source === value}
                      count={count}
                      onClick={() => set("source", f.source === value ? "all" : value)}
                    >
                      <Layers className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                      {label}
                    </FacetButton>
                  ))}
                </FacetGroup>
              )}
            </aside>

            {/* ── Records ─────────────────────────────────────────────── */}
            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">
                  <span className="tabular font-semibold text-ink">{filtered.length}</span>
                  {filtered.length === 1 ? " record" : " records"}
                  {activeCount > 0 && " match your filters"}
                </span>
                {activeCount > 0 && (
                  <button
                    onClick={() => setF(EMPTY)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} /> Clear filters
                  </button>
                )}
              </div>

              {filtered.length === 0 ? (
                <NoMatches onClear={() => setF(EMPTY)} />
              ) : (
                // One fade for the whole list — a per-card stagger over 56 records reads
                // as a 2.5s cascade and re-fires on every filter keystroke. The list is
                // the data; it should arrive at once, snappily.
                <motion.div variants={rise} initial="hidden" animate="show" className="space-y-4">
                  {filtered.map((r) => (
                    <RecordCard key={r.id} record={r} />
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function RecordCard({ record: r }: { record: KnowledgeRecord }) {
  const meta = topicMeta(r.topic);
  const TopicIcon = meta.icon;
  const aboutSomeoneElse =
    r.subject_is_person && r.subject_name && r.subject_name !== r.speaker_name;

  return (
    <article className="lift rounded-card border border-line bg-surface p-5 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
          <TopicIcon className="h-3.5 w-3.5 text-accent/70" strokeWidth={1.75} />
          {meta.label}
          {r.synthetic && (
            <span
              title="Compiled from a generated example call, not a real conversation."
              className="rounded-chip bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-ink-soft ring-1 ring-inset ring-ink/[0.06]"
            >
              Synthetic example
            </span>
          )}
        </span>
        {r.tag ? (
          <ConfidenceBadge confidence={confidenceForTag(r.tag)} />
        ) : (
          <span
            title="Directives and admissions carry no trust tag. They are handling context, not verified claims."
            className="inline-flex items-center rounded-chip bg-surface-sunken px-2.5 py-1 text-xs font-semibold tracking-tight text-ink-soft ring-1 ring-inset ring-ink/[0.04]"
          >
            {KIND_LABEL[r.kind]}
          </span>
        )}
      </div>

      <p className="mt-3 text-[0.95rem] leading-relaxed text-ink">{r.claim_text}</p>

      {r.evidence_quote && (
        <EvidenceQuoteCard
          claim={r}
          sourceLabel={r.source_label}
          showLink={false}
          className="mt-4"
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-faint">
        {r.speaker_name && (
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-medium text-ink-soft">{r.speaker_name}</span>
            {r.speaker_role && <span>· {r.speaker_role}</span>}
          </span>
        )}
        {aboutSomeoneElse && <span>about {r.subject_name}</span>}
        {r.mention_count > 1 && (
          <span className="inline-flex items-center gap-1 tabular">
            <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={1.75} />
            mentioned {r.mention_count} times
          </span>
        )}
      </div>
    </article>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function FacetButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-all duration-150 ease-standard",
        active
          ? "bg-accent-soft font-medium text-accent-ink"
          : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{children}</span>
      <span className={cn("tabular text-xs", active ? "text-accent-ink/70" : "text-ink-faint")}>
        {count}
      </span>
    </button>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="card-hairline flex flex-col items-center rounded-card border border-line bg-surface px-8 py-16 text-center">
      <Search className="h-8 w-8 text-ink-faint/60" strokeWidth={1.5} />
      <p className="mt-4 font-medium text-ink">No records match these filters</p>
      <p className="mt-1 text-sm text-ink-soft">Try a broader topic or trust level.</p>
      <button
        onClick={onClear}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
      >
        Clear filters
      </button>
    </div>
  );
}

function EmptyStore() {
  return (
    <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
      <Layers className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
      <p className="mt-4 font-display text-xl text-ink">No records yet</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Records appear here as interviews are compiled. Run the first interview and your
        company context fills with claims, each tagged by how well it is verified.
      </p>
    </div>
  );
}
