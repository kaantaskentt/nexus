// Live API adapters (task #14) — real api() calls against the backend, mapping each
// router's response shape onto the frontend types the screens already consume. These
// mirror the mock functions in mocks.ts one-for-one; a screen flips by importing from
// here instead of mocks.ts, and the corresponding mock is deleted (P0 standing rule).
//
// NOT YET WIRED into the screens: waiting on backend-ontology for (a) the demo tenant
// workspace_id + a compiled session_id, (b) a snapshot endpoint (none exists yet), and
// (c) workspace config. The pure mappers below are shape-correct regardless of which
// tenant is chosen, so wiring is a one-line import swap once those land.

import { api } from "./api";
import type {
  ClaimRecord,
  InterviewPlan,
  PlanMission,
  PlanTopic,
  Report,
  StepStatus,
  ToolKind,
  Workspace,
  WorkflowStep,
} from "./types";

// asyncpg returns jsonb columns as strings through dict(r); parse defensively.
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

// ── Workspaces (GET /api/workspaces) ─────────────────────────────────────────
// The row carries no config yet; the picker overlays demo display metadata until the
// backend adds config (tracked with backend-ontology).
export async function list_workspaces(): Promise<Workspace[]> {
  return api<Workspace[]>("/api/workspaces");
}

// ── Claims (GET /api/claims/{workspace_id} — client_visible_claims view) ──────
interface RawClaim {
  id: string;
  workspace_id: string;
  session_id: string | null;
  scrape_source_id: string | null;
  speaker_id: string | null;
  subject_id: string | null;
  kind: ClaimRecord["kind"];
  topic: ClaimRecord["topic"];
  tag: ClaimRecord["tag"];
  claim_text: string;
  evidence_quote: string | null;
  evidence_ts: string | null;
  hedge_signals: unknown;
  sentiment_flag: boolean;
  approach_note: string | null;
  mention_count: number;
  supersedes_id: string | null;
  created_at: string;
}

export async function list_claims(
  workspace_id: string,
  topic?: string,
): Promise<ClaimRecord[]> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  const rows = await api<RawClaim[]>(`/api/claims/${workspace_id}${q}`);
  return rows.map((r) => ({
    id: r.id,
    workspace_id: r.workspace_id,
    session_id: r.session_id,
    scrape_source_id: r.scrape_source_id,
    speaker_id: r.speaker_id,
    subject_id: r.subject_id,
    kind: r.kind,
    topic: r.topic,
    tag: r.tag,
    claim_text: r.claim_text,
    evidence_quote: r.evidence_quote,
    evidence_ts: r.evidence_ts,
    hedge_signals: parseJson<string[]>(r.hedge_signals, []),
    sentiment_flag: r.sentiment_flag,
    approach_note: r.approach_note, // never rendered client-side (guarded by tests)
    mention_count: r.mention_count,
    supersedes_id: r.supersedes_id,
    // F33 rule (pending backend confirm): interview-sourced (has session_id) evidence is
    // paraphrased; scraped / CEO-discovery records (no session_id) stay verbatim.
    is_paraphrased: r.session_id != null,
    created_at: r.created_at,
  }));
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

// Live mission topics arrive as {tier, objective}; the UI wants {label, must_hit}.
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
    definition_of_done:
      (m.definition_of_done as string[]) ?? (m.DoD as string[]) ?? [],
    handling_notes: (m.handling_notes as string[]) ?? [],
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

function mapPlan(r: RawPlan): InterviewPlan {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    round_id: r.round_id,
    interviewee_id: r.interviewee_id,
    interviewee_name: r.interviewee_name ?? undefined,
    interviewee_role: r.interviewee_role ?? undefined,
    state: r.state,
    is_custom_path: r.is_custom_path,
    mission: mapMission(r.mission),
    suggested_questions: parseJson(r.suggested_questions, []),
    never_list: parseJson<string[]>(r.never_list, []),
    suppressed_flags: parseJson(r.suppressed_flags, []),
    change_log: parseJson(r.change_log, []),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ── Report (GET /api/reports/{session_id}) ───────────────────────────────────
interface RawReportStep {
  step_index: number;
  action: string;
  tool: string | null;
  input: string | null;
  output: string | null;
  verified: "verified" | "partial" | "unverified";
  claim_ids: string[];
}
interface RawReport {
  session_id: string;
  workspace_id: string;
  workflow: { name: string; steps: RawReportStep[] } | null;
  perception_gaps: Array<{
    resolution?: { gap?: string; magnitude?: string } | null;
    claim_a: { text: string };
    claim_b: { text: string };
  }>;
  key_findings: Array<{ text: string; tag?: string; pain_band?: string | null }>;
  follow_up_on: Array<{ text: string }>;
  interview_quality: { headline?: string; objectives?: unknown[] } | null;
}

// Map the backend's verified enum to the UI step status (unverified → needs_clarification).
function stepStatus(v: RawReportStep["verified"]): StepStatus {
  return v === "unverified" ? "needs_clarification" : v;
}

// Best-effort tool-kind inference from the free-text tool name (icon selection only).
function toolKind(name: string | null): ToolKind {
  const t = (name ?? "").toLowerCase();
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("excel") || t.includes("sheet")) return "excel";
  if (t.includes("shopify")) return "shopify";
  if (t.includes("print")) return "printer";
  if (t.includes("notion")) return "notion";
  if (t.includes("apify")) return "apify";
  if (t.includes("email") || t.includes("mail")) return "email";
  return "unknown";
}

export async function get_report(session_id: string): Promise<Report | undefined> {
  const r = await api<RawReport & { error?: string }>(`/api/reports/${session_id}`);
  if (r.error) return undefined;

  const steps: WorkflowStep[] = (r.workflow?.steps ?? []).map((s) => ({
    index: s.step_index,
    title: s.action, // live has no separate title — the action IS the step name
    tool: { kind: toolKind(s.tool), name: s.tool ?? "Unknown" },
    input: s.input ?? undefined,
    action: s.action,
    output: s.output ?? undefined,
    status: stepStatus(s.verified),
  }));

  const gap = r.perception_gaps[0];
  return {
    workspace_id: r.workspace_id,
    plan_id: r.session_id, // report keyed by session; screen uses it as the route id
    interviewee_name: "",
    interviewee_role: "",
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
    quality: {
      objectives_captured: (r.interview_quality?.objectives?.length as number) ?? 0,
      objectives_total: (r.interview_quality?.objectives?.length as number) ?? 0,
      percent: 0,
      partial_dodged: 0,
      note: r.interview_quality?.headline ?? "",
    },
  };
}
