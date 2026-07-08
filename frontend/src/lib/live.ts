// Live API layer (task #14) — real api() calls against the backend, mapping each
// router's response onto the frontend types. Backend matched my SnapshotCard/PersonRef/
// Workspace.config shapes, so most of this is passthrough; only claims (tag nullability),
// plans (jsonb-string fields), and the report need real mapping. Verified against the
// canonical bee-goddess-demo tenant on :8000. Screens import from here; mocks.ts is
// deleted as each surface flips (P0 standing rule).

import { api } from "./api";
import type {
  ClaimRecord,
  KnowledgeRecord,
  InsightsData,
  InterviewPlan,
  TrustTag,
  PlanMission,
  PlanTopic,
  Report,
  SnapshotCard,
  Workspace,
  WorkflowStep,
  EffectiveWorkflow,
  WorkflowEditOp,
  WorkflowHistoryEntry,
  WorkflowSop,
  SkillBlueprint,
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
// Server-used reads take an optional `token`: Client Components omit it (api() resolves
// the browser session), Server Components pass the request token (lib/server-token.ts) via
// the lib/live-server.ts wrappers. See P0-1 in api.ts.
export async function list_workspaces(token?: string): Promise<Workspace[]> {
  return api<Workspace[]>("/api/workspaces", undefined, token);
}

export async function get_workspace(slug: string, token?: string): Promise<Workspace | undefined> {
  const all = await list_workspaces(token);
  return all.find((w) => w.slug === slug);
}

// Create a real tenant (A17 Stage 0). is_demo=false, zero records (A12 firewall).
export interface NewCompany {
  name: string;
  industry?: string;
  website?: string;
  contact_person?: string;
}
export async function create_workspace(body: NewCompany): Promise<Workspace> {
  return api<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── CEO discovery upload (A17 / #6) ──────────────────────────────────────────
// Upload a transcript -> standard compile job -> poll status -> snapshot renders.
export interface DiscoveryStart {
  session_id: string;
  round_id: string;
  job_id: number;
  turns: number;
}
export async function upload_discovery(
  workspace_id: string,
  transcript: string,
  speaker_name?: string,
  session_kind?: "interview" | "people_map" | "demo",
): Promise<DiscoveryStart> {
  return api<DiscoveryStart>(`/api/workspaces/${workspace_id}/discovery`, {
    method: "POST",
    body: JSON.stringify({
      transcript,
      speaker_name: speaker_name || undefined,
      session_kind: session_kind || undefined,
    }),
  });
}

export async function generate_demo_transcript(
  workspace_id: string,
): Promise<{ transcript: string; synthetic: boolean; session_kind: "demo" }> {
  return api(`/api/workspaces/${workspace_id}/demo-transcript`, { method: "POST" });
}

export interface DiscoveryStatus {
  session_id: string;
  state: "running" | "done" | "failed";
  stages: { kind: string; status: "pending" | "queued" | "running" | "done" | "failed" }[];
  claims: number;
  cards: number;
}
export async function discovery_status(
  workspace_id: string,
  session_id: string,
): Promise<DiscoveryStatus> {
  return api<DiscoveryStatus>(
    `/api/workspaces/${workspace_id}/discovery/${session_id}/status`,
  );
}

// ── Optional Stage-1 website scan (A17 / #7, best-effort) ────────────────────
export async function trigger_recon(
  workspace_id: string,
  website_url: string,
): Promise<{ job_id: number }> {
  return api(`/api/workspaces/${workspace_id}/recon`, {
    method: "POST",
    body: JSON.stringify({ website_url }),
  });
}

export interface ReconStatus {
  job_status: "queued" | "running" | "done" | "failed" | "unknown";
  scraped_records: number;
  people: number;
}
export async function recon_status(
  workspace_id: string,
  job_id: number,
): Promise<ReconStatus> {
  return api<ReconStatus>(`/api/workspaces/${workspace_id}/recon/status?job_id=${job_id}`);
}

// ── Voice settings (GET/PUT /api/voice-config/{id}) — Sprint-2 Lane B / #39 ───
// Per-workspace interview voice. The private VAPI key stays server-side; the editor
// only ever sees config + an honest sync status (never the key). Uncustomized workspaces
// resolve to the shared default assistant, so this is safe to open on any tenant.
export interface VoiceOption {
  voice_id: string;
  label: string;
  gender: "F" | "M";
  note: string;
  provider: "11labs" | "deepgram"; // A20: ElevenLabs joined the roster (ryan is the default)
  preview_url: string | null; // public sample clip; null = none exists, render no play button
}
export interface VoiceConfig {
  gender: "F" | "M";
  voice_id: string;
  speed: number;
  first_message: string | null;
  assistant_id: string;
  is_custom: boolean; // a dedicated per-workspace assistant exists
  vapi_synced: boolean; // the live assistant reflects this config
  vapi_configured: boolean; // the server has a VAPI key at all
  voices: VoiceOption[];
  sync_error?: string | null; // set on save when the push couldn't go live
}

export async function get_voice_config(workspace_id: string, token?: string): Promise<VoiceConfig> {
  return api<VoiceConfig>(`/api/voice-config/${workspace_id}`, undefined, token);
}

export async function save_voice_config(
  workspace_id: string,
  body: { voice_id: string; speed: number; first_message?: string | null },
): Promise<VoiceConfig> {
  return api<VoiceConfig>(`/api/voice-config/${workspace_id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
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
  token?: string,
): Promise<ClaimRecord[]> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  const rows = await api<RawClaim[]>(`/api/claims/${workspace_id}${q}`, undefined, token);
  return rows.map((r) => ({
    ...r,
    hedge_signals: parseJson<string[]>(r.hedge_signals, []),
    // F33 is authoritative from the backend now (false = CEO/scraped verbatim).
    is_paraphrased: r.is_paraphrased ?? false,
  }));
}

// ── Knowledge Base records (GET /api/claims/{id}/records) ────────────────────
// The record-store browser. The backend shapes each row (resolved names, F33 flag,
// no embedding vector), so this is passthrough onto the KnowledgeRecord type.
export async function list_knowledge(workspace_id: string, token?: string): Promise<KnowledgeRecord[]> {
  return api<KnowledgeRecord[]>(`/api/claims/${workspace_id}/records`, undefined, token);
}

// ── Insights (GET /api/workspaces/{id}/insights) ─────────────────────────────
// Cross-interview intelligence — conflicts, banded pains, admissions worth chasing.
// The backend already shapes each field, so this is passthrough onto InsightsData.
export async function get_insights(workspace_id: string, token?: string): Promise<InsightsData> {
  return api<InsightsData>(`/api/workspaces/${workspace_id}/insights`, undefined, token);
}

// ── Snapshot cards (GET /api/workspaces/{id}/snapshot) ───────────────────────
// Content shapes match SnapshotCard exactly (backend contract) — passthrough.
export async function list_snapshot_cards(
  workspace_id: string,
  token?: string,
): Promise<SnapshotCard[]> {
  return api<SnapshotCard[]>(`/api/workspaces/${workspace_id}/snapshot`, undefined, token);
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

export async function list_plans(workspace_id: string, token?: string): Promise<InterviewPlan[]> {
  const rows = await api<RawPlan[]>(`/api/plans/${workspace_id}`, undefined, token);
  return rows.map(mapPlan);
}

// Generate an interview plan for a suggested person (A17 journey: snapshot -> PLAN).
// Creates a DRAFT plan and runs the standard generate_plan job; the plan lands at
// NEXUS_CHECK. Poll list_plans until the new plan's state flips from DRAFT.
export async function generate_plan(
  workspace_id: string,
  person: { entity_id?: string; person_name?: string; person_role?: string; goal?: string },
): Promise<{ plan_id: string; state: string; job_id: number }> {
  return api<{ plan_id: string; state: string; job_id: number }>(`/api/plans/generate`, {
    method: "POST",
    body: JSON.stringify({ workspace_id, ...person }),
  });
}

// ── Fireflies import (Kaan verdict 7, July 7) ────────────────────────────────
export interface FirefliesMeeting {
  id: string;
  title: string;
  date?: string | number | null;
  duration_min?: number | null;
}
export async function list_fireflies_meetings(): Promise<FirefliesMeeting[]> {
  return api<FirefliesMeeting[]>("/api/integrations/fireflies/meetings");
}
export async function get_fireflies_meeting(id: string): Promise<{
  id: string;
  title?: string | null;
  speakers: string[];
  transcript: string;
}> {
  return api(`/api/integrations/fireflies/meetings/${id}`);
}

// ── Refine Plan chat (V2 #20 API; panel wired July 7, Kaan P1-B) ─────────────
export interface RefineResult {
  accepted: boolean;
  reply: string;
  alternative?: string | null;
  applied: { target: string; op: string; value: string }[];
  rejected: { target?: string; op?: string; value?: string; reason?: string }[];
}
export async function refine_plan(plan_id: string, instruction: string): Promise<RefineResult> {
  return api<RefineResult>(`/api/plans/${plan_id}/refine-chat`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

// ── Context chat (#20 APIs, UI door July 7) ──────────────────────────────────
export interface ChatCitation {
  record_id: string;
  tag: TrustTag | null;
  claim_text: string;
  evidence_quote: string | null;
  topic: string;
}
export interface ChatAnswer {
  answer: string;
  citations: ChatCitation[];
  suggestions: string[];
}
export async function ask_context(workspace_id: string, question: string): Promise<ChatAnswer> {
  return api<ChatAnswer>(`/api/chat/${workspace_id}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}
export async function add_context(
  workspace_id: string,
  statement: string,
): Promise<{ ok: boolean; session_id: string; job_id: number }> {
  return api<{ ok: boolean; session_id: string; job_id: number }>(
    `/api/chat/${workspace_id}/add-context`,
    { method: "POST", body: JSON.stringify({ statement }) },
  );
}

export async function get_plan(
  workspace_id: string,
  plan_id: string,
  token?: string,
): Promise<InterviewPlan | undefined> {
  const rows = await list_plans(workspace_id, token);
  return rows.find((p) => p.id === plan_id);
}

// Plan lifecycle transition (server validates legality; the UI only requests it).
export async function transition_plan(
  plan_id: string,
  to_state: string,
): Promise<{ to: string }> {
  return api(
    `/api/plans/${plan_id}/transition?to_state=${encodeURIComponent(to_state)}&actor=admin`,
    { method: "POST" },
  );
}

// Send Interview (A4) — mints the token-keyed respondent session from an APPROVED plan
// and moves the plan to SENT. Returns the invite link the respondent opens.
export interface SendResult {
  session_id: string;
  token: string;
  invite_path: string; // "/i/{token}"
  invite_url: string;
  state: string;
}
export async function send_interview(
  plan_id: string,
  details: { interviewee_name?: string; email?: string; job_title?: string; language?: string },
): Promise<SendResult> {
  return api<SendResult>(`/api/plans/${plan_id}/send`, {
    method: "POST",
    body: JSON.stringify(details),
  });
}

// ── Sessions (GET /api/workspaces/{id}/sessions) — find the compiled one ──────
export interface SessionSummary {
  id: string;
  status: string;
  modality: "text" | "voice";
  has_report: boolean;
  interviewee_name?: string | null;
  interviewee_role?: string | null;
}

interface RawSessionSummary {
  id: string;
  status: string;
  modality: "text" | "voice";
  has_report: boolean;
  interviewee?: string | null; // the endpoint returns a name string under `interviewee`
  interviewee_role?: string | null;
}

export async function list_sessions(workspace_id: string, token?: string): Promise<SessionSummary[]> {
  const rows = await api<RawSessionSummary[]>(`/api/workspaces/${workspace_id}/sessions`, undefined, token);
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    modality: r.modality,
    has_report: r.has_report,
    interviewee_name: r.interviewee ?? undefined,
    interviewee_role: r.interviewee_role ?? undefined,
  }));
}

// Simulated interviews (session_kind='eval') — the Simulations surface. Same shape as
// real sessions; the backend keeps the two classes firewalled (0007), so this list can
// never leak into Interviews or vice versa.
export async function list_simulations(workspace_id: string, token?: string): Promise<SessionSummary[]> {
  const rows = await api<RawSessionSummary[]>(
    `/api/workspaces/${workspace_id}/sessions?kind=eval`,
    undefined,
    token,
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    modality: r.modality,
    has_report: r.has_report,
    interviewee_name: r.interviewee ?? undefined,
    interviewee_role: r.interviewee_role ?? undefined,
  }));
}

// ── Observer (GET/POST /api/observer/...) — A19 admin live window ─────────────
// Everything here is REAL stored state: verbatim utterances, the coverage map the turn
// engine actually computed (null = not tracked; the UI says so, never fakes a ring),
// CLAIMED-pinned observer insights, and post-compile claims with their true tags. Badges
// are derived ONLY via trust.ts/confidenceForTag (A19 correction #1).
export interface ObserverUtterance {
  turn_index: number;
  speaker: "agent" | "respondent";
  text: string;
  at: string;
}
export interface ObserverInsight {
  id: number;
  text: string;
  trust_tag: TrustTag; // always CLAIMED (data-layer pinned) — badge via confidenceForTag
  at: string;
}
export interface ObserverClaim {
  id: string;
  text: string;
  tag: TrustTag;
  evidence_quote: string | null;
  at: string;
}
export interface CoverageObjective {
  label: string;
  status?: "satisfied" | "partial" | "untouched";
  must_hit?: boolean;
}
export interface ObserverState {
  session: {
    id: string;
    status: string;
    modality: "text" | "voice";
    started_at: string | null;
    interviewee: string | null;
    interviewee_role: string | null;
  };
  utterances: ObserverUtterance[];
  objectives: Array<string | CoverageObjective>;
  coverage: { objectives?: CoverageObjective[] } | null;
  coverage_tracking_enabled: boolean;
  insights: ObserverInsight[];
  claims: ObserverClaim[];
}

export async function observe_session(
  workspace_id: string,
  session_id: string,
  token?: string,
): Promise<ObserverState> {
  return api<ObserverState>(`/api/observer/${workspace_id}/sessions/${session_id}`, undefined, token);
}

export async function add_observer_insight(
  workspace_id: string,
  session_id: string,
  text: string,
): Promise<ObserverInsight> {
  return api<ObserverInsight>(`/api/observer/${workspace_id}/sessions/${session_id}/insights`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
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
  // All conflicts this session is party to (perception_gaps is a frequently-empty subset).
  conflict_points?: Array<{
    kind: string;
    resolution?: { gap?: string } | null;
    claim_a: { text: string; tag: string | null };
    claim_b: { text: string; tag: string | null };
  }>;
  key_findings: Array<{ text: string; pain_band?: string | null }>;
  follow_up_on: Array<{ text: string }>;
  interview_quality: {
    headline?: string;
    objectives?: unknown[];
    counts?: { satisfied: number; partial: number; dodged: number; untouched: number };
  } | null;
  error?: string;
}

export async function get_report(
  session_id: string,
  meta?: { interviewee_name?: string; interviewee_role?: string },
  token?: string,
): Promise<Report | undefined> {
  const r = await api<RawReport>(`/api/reports/${session_id}`, undefined, token);
  if (r.error) return undefined;

  const steps: WorkflowStep[] = r.workflow?.steps ?? [];

  // Prefer the real objective counts when present; fall back to the qualitative
  // headline when the compiler set no plan objectives.
  const c = r.interview_quality?.counts;
  const total = c ? c.satisfied + c.partial + c.dodged + c.untouched : 0;
  return {
    workspace_id: r.workspace_id,
    plan_id: r.session_id,
    interviewee_name: meta?.interviewee_name ?? "",
    interviewee_role: meta?.interviewee_role ?? "",
    status_label: "Interview completed",
    duration_min: 0,
    workflow_name: r.workflow?.name ?? "Workflow",
    steps,
    conflicts: (r.conflict_points ?? []).map((k) => ({
      kind: k.kind,
      note: k.resolution?.gap ?? null,
      a: { text: k.claim_a.text, tag: (k.claim_a.tag as TrustTag | null) ?? null },
      b: { text: k.claim_b.text, tag: (k.claim_b.tag as TrustTag | null) ?? null },
    })),
    key_findings: r.key_findings.map((f) => ({ text: f.text })),
    follow_ups: r.follow_up_on.map((f) => ({ text: f.text })),
    quality: {
      objectives_captured: c?.satisfied ?? 0,
      objectives_total: total,
      percent: total > 0 ? Math.round(((c?.satisfied ?? 0) / total) * 100) : 0,
      partial_dodged: c ? c.partial + c.dodged : 0,
      note: r.interview_quality?.headline ?? "",
    },
  };
}

// A report is still compiling if the Phase-6 fan-out hasn't produced a workflow or
// findings yet (backend populates progressively after /complete). Used by the report
// screen to show a "compiling…" state and poll instead of rendering an empty shell.
export function reportIsCompiling(report: Report): boolean {
  return report.steps.length === 0 && report.key_findings.length === 0;
}

// ── Workflow editor (V2 #21) — ontology-safe overlay API ─────────────────────
// The base workflow is immutable; every edit is an append-only overlay and the API
// returns the folded "effective" workflow, which the editor reconciles into its store.

// Workspace-scoped discovery — mirrors list_claims/list_plans so a caller with only a
// workspace_id can find its workflows (id + step count) and open the editor.
export interface WorkflowSummary {
  workflow_id: string;
  name: string;
  session_id: string | null;
  step_count: number;
}

export async function get_workflows(workspace_id: string, token?: string): Promise<WorkflowSummary[]> {
  return api<WorkflowSummary[]>(`/api/workflows/${workspace_id}`, undefined, token);
}

export async function get_workflow_by_session(session_id: string): Promise<EffectiveWorkflow> {
  return api<EffectiveWorkflow>(`/api/workflows/by-session/${session_id}/effective`);
}

export async function get_effective_workflow(workflow_id: string, token?: string): Promise<EffectiveWorkflow> {
  return api<EffectiveWorkflow>(`/api/workflows/${workflow_id}/effective`, undefined, token);
}

// Apply one edit; the server records the overlay (with prior_value provenance) and
// returns the fresh effective workflow to reconcile the optimistic store against.
export async function apply_workflow_edit(
  workflow_id: string,
  op: WorkflowEditOp,
  step_id: string | null,
  payload: Record<string, unknown>,
): Promise<{ overlay_id: string; effective: EffectiveWorkflow }> {
  return api(`/api/workflows/${workflow_id}/edit`, {
    method: "POST",
    body: JSON.stringify({ op, step_id, payload, actor: "admin" }),
  });
}

export async function get_workflow_history(workflow_id: string): Promise<WorkflowHistoryEntry[]> {
  return api<WorkflowHistoryEntry[]>(`/api/workflows/${workflow_id}/history`);
}

export async function request_sop(workflow_id: string): Promise<{ job_id: string; status: string }> {
  return api(`/api/workflows/${workflow_id}/sop`, { method: "POST" });
}

export async function get_sop(workflow_id: string): Promise<WorkflowSop> {
  return api<WorkflowSop>(`/api/workflows/${workflow_id}/sop`);
}

export async function get_blueprint(workflow_id: string): Promise<SkillBlueprint> {
  return api<SkillBlueprint>(`/api/workflows/${workflow_id}/blueprint`);
}
