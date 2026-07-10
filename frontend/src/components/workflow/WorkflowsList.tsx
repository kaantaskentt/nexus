"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LayoutGrid,
  ListChecks,
  Network,
  Settings2,
  ShoppingBag,
  Megaphone,
  Wallet,
  Headset,
  Users,
  Package,
} from "lucide-react";
import type { WorkflowSummary } from "@/lib/live";
import { WorkflowConfidenceChip } from "./WorkflowConfidenceChip";
import { cn } from "@/lib/cn";

// Department → icon. Unknown/unclassified workflows carry no department and render with the
// neutral Network glyph under "All". We never invent a department client-side either.
const DEPT_ICON: Record<string, typeof Network> = {
  Operations: Settings2,
  Sales: ShoppingBag,
  Marketing: Megaphone,
  Finance: Wallet,
  "Customer Service": Headset,
  People: Users,
  Product: Package,
};

// Stable department display order; anything off-list sorts after, then alphabetical.
const DEPT_ORDER = ["Operations", "Sales", "Marketing", "Finance", "Customer Service", "People", "Product"];

function agoLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `Updated ${days}d ago`;
  const months = Math.round(days / 30);
  return `Updated ${months}mo ago`;
}

// Workflows list (Feedback C / image12): an "All" chip default plus a chip for each
// department that ACTUALLY exists in this workspace (no fixed Sales/Marketing tabs when the
// company has none). Cards carry the one-line description, step count, a derived confidence
// chip, and a truthful updated-ago. Filtering is the only client behavior; classification is
// entirely server-side (a null department simply lives under All).
export function WorkflowsList({
  slug,
  workflows,
}: {
  slug: string;
  workflows: WorkflowSummary[];
}) {
  // Departments present in this workspace, in stable order.
  const departments = useMemo(() => {
    const present = new Set(workflows.map((w) => w.department).filter((d): d is string => !!d));
    return Array.from(present).sort((a, b) => {
      const ia = DEPT_ORDER.indexOf(a), ib = DEPT_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  }, [workflows]);

  const [active, setActive] = useState<string>("All");
  const shown = useMemo(
    () => (active === "All" ? workflows : workflows.filter((w) => w.department === active)),
    [active, workflows],
  );

  return (
    <div>
      {/* Filter chips — only render the row when there is at least one department to filter by. */}
      {departments.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Chip label="All" icon={LayoutGrid} active={active === "All"} onClick={() => setActive("All")} />
          {departments.map((d) => (
            <Chip
              key={d}
              label={d}
              icon={DEPT_ICON[d] ?? Network}
              active={active === d}
              onClick={() => setActive(d)}
            />
          ))}
        </div>
      )}

      <div className="card-hairline mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {shown.map((w) => {
          const Icon = (w.department && DEPT_ICON[w.department]) || Network;
          return (
            <Link
              key={w.workflow_id}
              href={`/w/${slug}/workflow/${w.workflow_id}`}
              className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-raised"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/15">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{w.name}</div>
                {w.description && (
                  <div className="mt-0.5 truncate text-sm text-ink-soft">{w.description}</div>
                )}
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-faint tabular sm:inline-flex">
                <ListChecks className="h-3.5 w-3.5" strokeWidth={1.75} />
                {w.step_count} {w.step_count === 1 ? "step" : "steps"}
              </div>
              <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
                <WorkflowConfidenceChip confidence={w.confidence} />
                {w.updated_at && (
                  <span className="text-xs text-ink-faint">{agoLabel(w.updated_at)}</span>
                )}
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          );
        })}
        {shown.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-ink-soft">
            No workflows in {active}. <button className="text-accent-ink underline-offset-2 hover:underline" onClick={() => setActive("All")}>Show all</button>.
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Network;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent/30 bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
    </button>
  );
}
