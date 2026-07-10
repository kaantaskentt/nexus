"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Users,
  Workflow,
  Building2,
  HelpCircle,
  GitCompareArrows,
  ArrowRight,
} from "lucide-react";
import { rise, staggerParent } from "@/lib/variants";
import { mark_snapshot_intro_seen } from "@/lib/live";
import brand from "@/lib/brand";

// SIMPLIFY B (image14, adapted to the Nexus design system): the one moment of arrival for
// the first compiled snapshot. Renders once — when cards exist AND the intro has not been
// dismissed (workspaces.config.snapshot_intro_seen). Kaan removed the co-primary
// "Generate plan" / "Review transcript" actions, so there is exactly ONE primary CTA:
// "View company snapshot", which persists the seen flag and reveals the snapshot in place.
//
// Every number here is a REAL count with a real destination (records, people, workflows,
// areas, perception gaps). A count that is not real is not shown — the caller passes only
// the stats it could derive honestly (no invented "systems mentioned").

export interface IntroStat {
  key: string;
  label: string;
  value: number;
}
export interface IntroCategory {
  key: string;
  title: string;
  desc: string;
  count: number;
  unit: string;
}

const ICONS: Record<string, typeof Sparkles> = {
  records: Sparkles,
  people: Users,
  workflows: Workflow,
  overview: Building2,
  areas: HelpCircle,
  conflicts: GitCompareArrows,
};

export function SnapshotIntro({
  workspaceId,
  companyName,
  stats,
  categories,
  children,
}: {
  workspaceId: string;
  companyName: string;
  stats: IntroStat[];
  categories: IntroCategory[];
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);

  function reveal() {
    // Optimistic: reveal the snapshot immediately, persist the flag best-effort. If the
    // POST fails the worst case is the intro shows again next visit — never a lost snapshot.
    setDismissed(true);
    mark_snapshot_intro_seen(workspaceId).catch(() => {});
  }

  if (dismissed) return <>{children}</>;

  return (
    <motion.section
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-6xl px-8 py-10"
    >
      <motion.div
        variants={rise}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        Snapshot ready
      </motion.div>

      <motion.h1 variants={rise} className="mt-4 font-display text-3xl leading-tight text-ink">
        Company snapshot ready
      </motion.h1>
      <motion.p variants={rise} className="mt-2 max-w-xl leading-relaxed text-ink-soft">
        {brand.product_name} turned your conversation into a structured first model of{" "}
        {companyName}. Here is what we have captured so far.
      </motion.p>

      {stats.length > 0 && (
        <motion.div
          variants={rise}
          className="card-hairline mt-6 grid grid-cols-2 gap-y-5 rounded-card border border-line bg-surface p-5 sm:grid-cols-3 lg:grid-cols-5"
        >
          {stats.map((s) => {
            const Icon = ICONS[s.key] ?? Sparkles;
            return (
              <div key={s.key} className="flex flex-col items-center text-center">
                <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                <div className="mt-2 font-display text-2xl text-ink tabular">{s.value}</div>
                <div className="mt-0.5 text-xs text-ink-faint">{s.label}</div>
              </div>
            );
          })}
        </motion.div>
      )}

      {categories.length > 0 && (
        <>
          <motion.h2 variants={rise} className="mt-8 text-sm font-semibold text-ink-soft">
            What we have captured so far
          </motion.h2>
          <motion.div
            variants={rise}
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {categories.map((cat) => {
              const Icon = ICONS[cat.key] ?? Sparkles;
              return (
                <div
                  key={cat.key}
                  className="card-hairline rounded-card border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
                    <div className="font-medium text-ink">{cat.title}</div>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{cat.desc}</p>
                  <div className="mt-3 inline-flex rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-faint">
                    {cat.count} {cat.unit}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </>
      )}

      <motion.div variants={rise} className="mt-8">
        <button
          onClick={reveal}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
        >
          View company snapshot
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </motion.div>
    </motion.section>
  );
}
