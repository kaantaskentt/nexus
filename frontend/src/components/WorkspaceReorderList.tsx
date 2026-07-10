"use client";

import { useState } from "react";
import Link from "next/link";
import { Reorder, useDragControls } from "framer-motion";
import { ArrowRight, GripVertical, Trash2 } from "lucide-react";
import { reorder_workspaces } from "@/lib/live";
import { WorkspaceDeleteDialog } from "@/components/WorkspaceDeleteDialog";

// SIMPLIFY §4-A: the picker's "other workspaces" rows are drag-reorderable. The hero is a
// computed spotlight rendered by the server page and is NOT part of this list; to keep the
// hero stable across reorders we persist it pinned at position 0 (heroId), then these rows
// in the order the admin arranged. Order semantics live on the backend (sort_order); this
// component only reports the new arrangement on drop.
export interface PickerRow {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  prepared: boolean;
}

export function WorkspaceReorderList({
  rows,
  heroId,
}: {
  rows: PickerRow[];
  heroId: string | null;
}) {
  const [items, setItems] = useState(rows);
  const [deleting, setDeleting] = useState<PickerRow | null>(null);

  async function persist() {
    const ordered = heroId ? [heroId, ...items.map((r) => r.id)] : items.map((r) => r.id);
    try {
      await reorder_workspaces(ordered);
    } catch {
      // A failed persist is non-fatal: the optimistic order stays on screen for this
      // session and the server order (unchanged) simply reasserts on next load. No data
      // is lost and nothing destructive happened, so we don't shout at the user here.
    }
  }

  return (
    <>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
        {items.map((row) => (
          <PickerRowItem key={row.id} row={row} onDrop={persist} onDelete={() => setDeleting(row)} />
        ))}
      </Reorder.Group>
      {items.length > 1 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
          Drag to reorder workspaces
        </p>
      )}
      {deleting && (
        <WorkspaceDeleteDialog
          workspaceId={deleting.id}
          name={deleting.name}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function PickerRowItem({
  row,
  onDrop,
  onDelete,
}: {
  row: PickerRow;
  onDrop: () => void;
  onDelete: () => void;
}) {
  // dragListener=false + a dedicated handle: the row body stays a normal navigation link,
  // only the grip starts a drag, so click-to-open and drag-to-reorder never fight.
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="lift card-hairline group flex items-center gap-1 rounded-card border border-line bg-surface pr-2 hover:border-line-strong"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag to reorder ${row.name}`}
        className="cursor-grab touch-none px-2 py-3 text-ink-faint transition hover:text-ink-soft active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <Link
        href={`/w/${row.slug}/home`}
        className="flex flex-1 items-center justify-between py-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised font-display text-sm text-ink-soft">
            {row.name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-medium text-ink">{row.name}</div>
            {row.industry && (
              <div className="text-xs capitalize text-ink-faint">{row.industry}</div>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
          {row.prepared ? "Open" : "Awaiting first call"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </Link>
      {/* Quiet delete affordance: dim until hover, never competing with Open. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${row.name}`}
        className="ml-1 rounded-full p-2 text-ink-faint opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </Reorder.Item>
  );
}
