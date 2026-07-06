"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2, ArrowRight, RotateCw } from "lucide-react";
import { generate_plan } from "@/lib/live";
import type { PersonRef } from "@/lib/types";

// Generate-interview-plan action for a snapshot's Suggested-Person row (A17 journey:
// snapshot -> PLAN). It calls the real generate_plan job (no faked progress). Generation
// is a multi-step LLM job that takes the better part of a minute, so we do NOT hold a
// spinner for it: once the plan record exists and the job is enqueued we move to the
// honest "in review" state. Per A4 the admin does not see the plan until it clears
// Nexus's own review, so the copy says exactly that and links to the Interview Plans
// page rather than pretending the plan is ready to send.
type Phase = "idle" | "working" | "review" | "error";

export function GeneratePlanButton({
  workspaceId,
  slug,
  person,
}: {
  workspaceId: string;
  slug: string;
  person: PersonRef;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function onGenerate() {
    setPhase("working");
    try {
      await generate_plan(workspaceId, {
        entity_id: person.entity_id,
        person_name: person.name,
        person_role: person.role,
      });
      setPhase("review");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "review") {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <Link
          href={`/w/${slug}/plans`}
          className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-1.5 text-sm font-medium text-tag-confirmed transition-colors hover:brightness-95"
        >
          In review
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <span className="max-w-[13rem] text-[11px] leading-snug text-ink-faint">
          Nexus is reviewing this plan before it reaches you.
        </span>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <button
        onClick={onGenerate}
        className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
      >
        <RotateCw className="h-4 w-4" strokeWidth={1.75} />
        Try again
      </button>
    );
  }

  return (
    <button
      onClick={onGenerate}
      disabled={phase === "working"}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent-ink transition-all duration-150 ease-standard hover:border-accent hover:bg-accent-soft disabled:cursor-progress disabled:opacity-70"
    >
      {phase === "working" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          Starting
        </>
      ) : (
        <>
          <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
          Generate plan
        </>
      )}
    </button>
  );
}
