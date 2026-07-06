"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2, Eye, ArrowRight, RotateCw } from "lucide-react";
import { generate_plan, list_plans } from "@/lib/live";
import type { PersonRef } from "@/lib/types";

// Generate-interview-plan action for a snapshot's Suggested-Person row (A17 journey:
// snapshot -> PLAN). It calls the real generate_plan job (never fakes progress), then
// polls the plan's lifecycle state until the worker advances it past DRAFT — meaning the
// mission has actually been generated. Per A4 the admin does NOT see the plan until it
// clears Nexus's own review, so the success state says exactly that and links to the
// Interview Plans page rather than pretending the plan is ready to send.
type Phase = "idle" | "working" | "review" | "error";

const REVIEW_NOTE = "Nexus is reviewing this plan before it reaches you.";

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
      const { plan_id } = await generate_plan(workspaceId, {
        entity_id: person.entity_id,
        person_name: person.name,
        person_role: person.role,
      });
      // Poll until the standard job flips the plan off DRAFT (mission generated). If it
      // is still running after ~40s the plan still exists and will land on the Plans
      // page, so we move to the honest "in review" state either way — never an error.
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 2000));
        const plans = await list_plans(workspaceId).catch(() => []);
        const p = plans.find((pl) => pl.id === plan_id);
        if (p && p.state !== "DRAFT") break;
      }
      setPhase("review");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "review") {
    return (
      <Link
        href={`/w/${slug}/plans`}
        title={REVIEW_NOTE}
        className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-1.5 text-sm font-medium text-tag-confirmed transition-colors hover:brightness-95"
      >
        <Eye className="h-4 w-4" strokeWidth={1.75} />
        In review
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
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
          Generating
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
