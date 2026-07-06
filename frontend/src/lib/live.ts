// Live API layer (task #14) — real api() calls against the backend, mapping each
// router's response onto the frontend types. Backend matched my SnapshotCard/PersonRef/
// Workspace.config shapes, so most of this is passthrough; only claims (tag nullability),
// plans (jsonb-string fields), and the report need real mapping. Verified against the
// canonical bee-goddess-demo tenant on :8000. Screens import from here; mocks.ts is
// deleted as each surface flips (P0 standing rule).

import { api } from "./api";
import type {
  ClaimRecord,
  InterviewPlan,
  PlanMission,
  PlanTopic,
  Report,
  SnapshotCard,
  Workspace,
  WorkflowStep,
} from "./types";

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

// ── Workspaces (GET /api/workspaces — now includes config) ───────────────────
export async function list_workspaces(): Promise<Workspace[]> {
  return api<Workspace[]>("/api/workspaces");
}

export async function get_workspace(slug: string): Promise<Workspace | undefined> {
  const all = await list_workspaces();
  return all.find((w) => w.slug === slug);
}

// ── Claims (GET /api/claims/{workspace_id}) ──────────────────────────────────
interface RawClaim extends Omit<ClaimRecord, "hedge_signals" | "is_paraphrased"> {
  hedge_signals: unknown;
  is_paraphrased?: boolean;
  speaker_role?: string | null;
}

export async function list_claims(
  workspace_id: string,
  topic?: string,
): Promise<ClaimRecord[]> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  const rows = await api<RawClaim[]>(`/api/claims/${workspace_id}${q}`);
  return rows.map((r) => ({
    ...r,
    hedge_signals: parseJson<string[]>(r.hedge_signals, []),
    // F33 is authoritative from the backend now (false = CEO/scraped verbatim).
    is_paraphrased: r.is_paraphrased ?? false,
  }));
}

// ── Snapshot cards (GET /api/workspaces/{id}/snapshot) ───────────────────────
// Content shapes match SnapshotCard exactly (backend contract) — passthrough.
export async function list_snapshot_cards(
  workspace_id: string,
): Promise<SnapshotCard[]> {
  return api<SnapshotCard[]>(`/api/workspaces/${workspace_id}/snapshot`);
}

// ── Plans (GET /api/plans/{workspace_id}) ────────────────────────────────────
interface RawPlan {
  id: string;
  workspace_id: string;
  round_id: string | null;
  interviewee_id: string | null;
  interviewee_name?: string | null;
  interviewee_role?: string | null;
  state: InterviewPlan["state"];
  is_custom_path: boolean;
  mission: unknown;
  suggested_questions: unknown;
  never_list: unknown;
  suppressed_flags: unknown;
  change_log: unknown;
  created_at: string;
  updated_at: string;
}

function mapMission(raw: unknown): PlanMission {
  const m = parseJson<Record<string, unknown>>(raw, {});
  const rawTopics = (m.topics as Array<Record<string, unknown>>) ?? [];
  const topics: PlanTopic[] = rawTopics.map((t) => ({
    label: (t.label as string) ?? (t.objective as string) ?? "",
    must_hit: t.must_hit != null ? Boolean(t.must_hit) : t.tier === "must_hit",
    detail: t.detail as string | undefined,
  }));
  return {
    goal: (m.goal as string) ?? "",
    known_context: (m.known_context as string[]) ?? [],
    topics,
    definition_of_done: (m.definition_of_done as string[]) ?? (m.DoD as string[]) ?? [],
    handling_notes: (m.handling_notes as string[]) ?? [],
  };
}

function mapPlan(r: RawPlan): InterviewPlan {
  const missionRaw = parseJson<Record<string, unknown>>(r.mission, {});
  const budget = missionRaw.time_budget_minutes as number | undefined;
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    round_id: r.round_id,
    interviewee_id: r.interviewee_id,
    interviewee_name: r.interviewee_name ?? undefined,
    interviewee_role: r.interviewee_role ?? undefined,
    interview_topic: missionRaw.interview_topic as string | undefined,
    state: r.state,
    is_custom_path: r.is_custom_path,
    mission: mapMission(r.mission),
    suggested_questions: parseJson(r.suggested_questions, []),
    never_list: parseJson<string[]>(r.never_list, []),
    suppressed_flags: parseJson(r.suppressed_flags, []),
    change_log: parseJson(r.change_log, []),
    est_time: budget
      ? { total_min: budget, opening_min: 3, topics_min: budget - 6, closing_min: 3 }
      : undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function list_plans(workspace_id: string): Promise<InterviewPlan[]> {
  const rows = await api<RawPlan[]>(`/api/plans/${workspace_id}`);
  return rows.map(mapPlan);
}

export async function get_plan(
  workspace_id: string,
  plan_id: string,
): Promise<InterviewPlan | undefined> {
  const rows = await list_plans(workspace_id);
  return rows.find((p) => p.id === plan_id);
}

// ── Sessions (GET /api/workspaces/{id}/sessions) — find the compiled one ──────
export interface SessionSummary {
  id: string;
  status: string;
  has_report: boolean;
  interviewee_name?: string | null;
  interviewee_role?: string | null;
}

export async function list_sessions(workspace_id: string): Promise<SessionSummary[]> {
  return api<SessionSummary[]>(`/api/workspaces/${workspace_id}/sessions`);
}

// ── Report (GET /api/reports/{session_id}) ───────────────────────────────────
// Backend enriched the workflow step to the frontend WorkflowStep shape (index/title/
// tool{kind,name}/status/confidence/captured_from/captured_paraphrase/unverified_questions),
// so steps pass through. Only the report-level fields (perception gap, quality, findings)
// still need mapping onto the screen's Report type.
interface RawReport {
  session_id: string;
  workspace_id: string;
  workflow: { name: string; steps: WorkflowStep[] } | null;
  perception_gaps: Array<{
    resolution?: { gap?: string } | null;
    claim_a: { text: string };
    claim_b: { text: string };
  }>;
  key_findings: Array<{ text: string; pain_band?: string | null }>;
  follow_up_on: Array<{ text: string }>;
  interview_quality: { headline?: string; objectives?: unknown[] } | null;
  error?: string;
}

export async function get_report(
  session_id: string,
  meta?: { interviewee_name?: string; interviewee_role?: string },
): Promise<Report | undefined> {
  const r = await api<RawReport>(`/api/reports/${session_id}`);
  if (r.error) return undefined;

  const steps: WorkflowStep[] = r.workflow?.steps ?? [];

  const gap = r.perception_gaps[0];
  const objs = r.interview_quality?.objectives?.length ?? 0;
  return {
    workspace_id: r.workspace_id,
    plan_id: r.session_id,
    interviewee_name: meta?.interviewee_name ?? "",
    interviewee_role: meta?.interviewee_role ?? "",
    status_label: "Interview completed",
    duration_min: 0,
    workflow_name: r.workflow?.name ?? "Workflow",
    steps,
    perception_gap: gap
      ? {
          estimate: gap.claim_a?.text ?? "",
          actual: gap.claim_b?.text ?? "",
          driver: gap.resolution?.gap ? `Gap: ${gap.resolution.gap}` : "",
        }
      : undefined,
    key_findings: r.key_findings.map((f) => ({ text: f.text })),
    follow_ups: r.follow_up_on.map((f) => ({ text: f.text })),
    // Live quality is qualitative (a headline + spine scores), not counts/percent.
    quality: {
      objectives_captured: objs,
      objectives_total: objs,
      percent: 0,
      partial_dodged: 0,
      note: r.interview_quality?.headline ?? "",
    },
  };
}
