"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2, ArrowRight, RotateCw } from "lucide-react";
import { generate_plan, get_plan } from "@/lib/live";
import type { PersonRef, PlanState } from "@/lib/types";

// Generate-interview-plan action for a snapshot's Suggested-Person row (A17 journey:
// snapshot -> PLAN). generate_plan() only creates a DRAFT and enqueues the LLM job; the
// plan does not actually reach "in review" until that job finishes and flips the state
// off DRAFT (it lands at NEXUS_CHECK per A4). So we do NOT claim "in review" the instant
// the POST returns — that would be spinner theater dressed as a done-state. Instead we
// poll the real plan state and hold an honest "Generating" while the job runs, only
// showing the done-state once the plan has genuinely left DRAFT. Per A4 the admin does
// not see the plan until it clears Nexus's own review, so the done-copy says exactly that
// and links to the Interview Plans page rather than pretending it is ready to send.
type Phase = "idle" | "generating" | "done" | "error";

// Poll cadence and ceiling. Generation is a multi-step LLM job that takes the better part
// of a minute; the ceiling is generous headroom, after which we hand off to the plans page
// honestly rather than spin forever (the plan exists there and shows its own live state).
const POLL_MS = 2500;
const MAX_POLLS = 48;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  // Non-null once the plan has left DRAFT (reached review). Null while in the "done" phase
  // means we hit the poll ceiling and the plan is still being prepared.
  const [reachedState, setReachedState] = useState<PlanState | null>(null);
  // The server's reason when generation fails — shown, never swallowed (Emre doc-2 P1).
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function onGenerate() {
    setPhase("generating");
    setReachedState(null);
    try {
      const { plan_id } = await generate_plan(workspaceId, {
        entity_id: person.entity_id,
        person_name: person.name,
        person_role: person.role,
      });
      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelled.current) return;
        const plan = await get_plan(workspaceId, plan_id);
        if (cancelled.current) return;
        if (plan && plan.state !== "DRAFT") {
          setReachedState(plan.state);
          setPhase("done");
          return;
        }
        await sleep(POLL_MS);
      }
      // Ceiling hit: the plan exists but generation is still running. Hand off honestly.
      if (cancelled.current) return;
      setReachedState(null);
      setPhase("done");
    } catch (e) {
      if (cancelled.current) return;
      setErrorDetail(e instanceof Error ? e.message : "The request failed");
      setPhase("error");
    }
  }

  if (phase === "done") {
    const label = reachedState ? "In review" : "Preparing";
    const note = reachedState
      ? "Nexus is reviewing this plan before it reaches you."
      : "Nexus is still preparing this plan. You can follow it on the Interview Plans page.";
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <Link
          href={`/w/${slug}/plans`}
          className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-1.5 text-sm font-medium text-tag-confirmed transition-colors hover:brightness-95"
        >
          {label}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <span className="max-w-[13rem] text-[11px] leading-snug text-ink-faint">{note}</span>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.75} />
          Try again
        </button>
        {/* Always say WHY — a bare retry that keeps failing reads as broken (it was). */}
        <span className="max-w-[14rem] text-[11px] leading-snug text-danger/80">
          {errorDetail ?? "The plan could not be created."}
        </span>
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent-ink">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        Generating
      </span>
    );
  }

  return (
    <button
      onClick={onGenerate}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent-ink transition-all duration-150 ease-standard hover:border-accent hover:bg-accent-soft"
    >
      <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
      Generate plan
    </button>
  );
}
