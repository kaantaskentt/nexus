import type { ReactNode } from "react";
import type { PersonRef } from "@/lib/types";
import { DiscoveryTag } from "./DiscoveryTag";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";


// A person as a table-style row (stage5 "Suggested People to Interview"). The
// why-line carries RESPONSIBILITY FACTS ONLY (F34) — the caller passes an
// already-filtered line; this component never synthesizes one. Avatars are initials,
// not photos: these people are fiction (A12) and we render no invented faces.
export function PersonRow({
  person,
  action,
  className,
}: {
  person: PersonRef;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
        {initials(person.name, "?")}
      </div>
      <div className="w-28 shrink-0">
        <div className="font-medium text-ink">{person.name || person.role || "Unknown"}</div>
        {person.name && person.role ? (
          <div className="text-xs text-ink-faint">{person.role}</div>
        ) : null}
      </div>
      <p className="min-w-[12rem] flex-1 text-sm text-ink-soft">
        <span className="font-medium text-accent-ink">Why: </span>
        {person.why_line}
      </p>
      {person.tag && <DiscoveryTag label={person.tag.label} tone={person.tag.tone} />}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
