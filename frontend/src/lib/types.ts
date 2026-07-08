// Shared types — mirror the backend schema (backend/db/migrations/0001_foundation.sql)
// and router responses (backend/app/routers/*). The mock layer (mocks.ts) is shaped
// EXACTLY like these so screens flip to the live API by swapping one import (A15.6).

// ── Trust ladder (F22 + A2): SCRAPED < GUESS < CLAIMED < CONFIRMED < VERIFIED ──
export type TrustTag = "SCRAPED" | "GUESS" | "CLAIMED" | "CONFIRMED" | "VERIFIED";

// ── Snapshot card confidence — the F35 split surfaced to clients ──────────────
// verified = independent agreement · high = single confirmed source ·
// reported = claimed, one voice · guess = unverified estimate (trust-ladder GUESS) ·
// scraped = ~20% reference weight (A2). The snapshot_cards.confidence enum column is
// (high|verified|reported|scraped); "guess" is used only inside content jsonb
// (per-belief), where the richer trust ladder applies.
export type Confidence = "verified" | "high" | "reported" | "guess" | "scraped";

export type ClaimKind = "statement" | "directive" | "admission" | "correction";
export type ClaimTopic =
  | "pain"
  | "process_step"
  | "person"
  | "tool"
  | "vocabulary"
  | "time_or_cost"
  | "company_fact"
  | "success_criteria";

export type PainBand = "low" | "moderate" | "high" | "severe";

// The 12 plan states — one source of truth is the backend TRANSITIONS map.
export type PlanState =
  | "DRAFT"
  | "NEXUS_CHECK"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "OPENED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "COMPILED"
  | "NO_RESPONSE"
  | "REVOKED";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  is_demo: boolean;
  // workspaces.config jsonb — display fields the picker/shell render (the live
  // router will need to select `config`; the demo carries it inline).
  config?: {
    founder?: string;
    founder_role?: string;
    tagline?: string; // e.g. "Fine jewelry — handcrafted in Istanbul"
    starting_focus?: string; // e.g. "daily repricing → content approval"
    source?: string; // e.g. "CEO Discovery Call + Website Scan"
    approved_for_pilot?: boolean;
    contact_person?: string; // A17 new-company Stage 0 field
    website?: string; // A17 new-company Stage 0 field (feeds the optional recon scan)
  };
}

// client_visible_claims view row (quarantined = false rows of claim_records).
export interface ClaimRecord {
  id: string;
  workspace_id: string;
  session_id: string | null;
  scrape_source_id: string | null;
  speaker_id: string | null;
  subject_id: string | null;
  kind: ClaimKind;
  topic: ClaimTopic;
  // DIRECTIVE / ADMISSION records carry no trust tag (FOR-TUNC #11) — nullable.
  tag: TrustTag | null;
  claim_text: string;
  evidence_quote: string | null;
  evidence_ts: string | null;
  hedge_signals: string[];
  sentiment_flag: boolean;
  approach_note: string | null;
  mention_count: number;
  supersedes_id: string | null;
  // interview-sourced evidence is paraphrased in client views (F33); the flag
  // lets EvidenceQuoteCard render the paraphrase affordance honestly.
  is_paraphrased?: boolean;
  created_at: string;
}

// ── Knowledge Base record (GET /api/claims/{id}/records) ─────────────────────
// A browsable claim row shaped for the record store: the trust tag (null for
// directives/admissions, which carry no tag), the F33 paraphrase flag, and the
// resolved speaker/subject/source names the topic/person/source filters key on.
// Sourced from client_visible_claims, so quarantined records are structurally absent.
export interface KnowledgeRecord {
  id: string;
  kind: ClaimKind;
  topic: ClaimTopic;
  tag: TrustTag | null;
  claim_text: string;
  evidence_quote: string | null;
  evidence_ts: string | null;
  mention_count: number;
  is_paraphrased: boolean;
  speaker_name: string | null;
  speaker_role: string | null;
  subject_name: string | null;
  subject_is_person: boolean;
  source_kind: "interview" | "scrape" | "unknown";
  source_id: string;
  source_label: string;
  // True when the record compiled from a generated example call (verdict 8): synthetic
  // data is labeled everywhere it appears, never blended silently into real records.
  synthetic?: boolean;
  created_at: string;
}

// ── Insights (GET /api/workspaces/{id}/insights) ─────────────────────────────
// Cross-interview intelligence. Conflict `kind` is left as a string because the
// pipeline emits kinds beyond the original three (e.g. now_vs_prior, a correction
// over time); the view labels known kinds and humanizes the rest. Both sides read
// through client_visible_claims, so a conflict shown here is quarantine-safe on both.
export type ConflictKind =
  | "ceo_vs_floor" | "worker_vs_worker" | "perception_gap" | "now_vs_prior" | string;

export interface ConflictSide {
  text: string;
  tag: TrustTag | null;
  speaker: string | null;
  role: string | null;
  session_id: string | null;
}

export interface InsightConflict {
  id: string;
  kind: ConflictKind;
  status: "disputed" | "resolved";
  note: string | null;
  a: ConflictSide;
  b: ConflictSide;
}

export interface KeyFinding {
  id: string;
  text: string;
  band: PainBand | null;
  tag: TrustTag | null;
  mention_count: number;
  evidence_quote: string | null;
  speaker: string | null;
  role: string | null;
  session_id: string | null;
  // Pain findings default to role-level attribution (reflect-back-close Beat 3,
  // hard-rule 8). The speaker's NAME renders only when the respondent explicitly
  // released it; absent/false means role-only. Compile-level enforcement of the full
  // F21/F34 release flow is Emre-gated — this is the render-side default.
  name_released?: boolean;
}

export interface Admission {
  id: string;
  text: string;
  evidence_quote: string | null;
  speaker: string | null;
  role: string | null;
  objective: string | null; // the INTERVIEW-OBJECTIVE follow-up this admission seeds
  session_id: string | null;
  // Role-level by default; the name renders only on explicit release (see KeyFinding).
  name_released?: boolean;
}

export interface InsightsData {
  conflicts: InsightConflict[];
  key_findings: KeyFinding[];
  admissions: Admission[];
  stats: { interviews: number; records: number; conflicts: number; gaps: number };
}

// mission jsonb shape (interview_plans.mission).
export interface PlanTopic {
  label: string;
  must_hit: boolean;
  detail?: string;
}

export interface PlanMission {
  goal: string;
  known_context: string[]; // locked — never reaches the interviewee as statements (#2)
  topics: PlanTopic[];
  definition_of_done: string[];
  handling_notes: string[];
  // Custom interviews (July 7): the admin's own focus text, honest provenance on review.
  custom_focus?: string | null;
}

export interface SuggestedQuestion {
  text: string;
  // when a leading question was auto-reformulated, we keep the original for the audit trail.
  reformulated_from?: string;
  topic?: ClaimTopic;
}

// One finding from a NEXUS_CHECK run, as written into the plan's change_log when the
// check RETURNs a draft. The plan page renders these so a returned draft always says WHY.
export interface PlanCheckFlag {
  kind?: string; // e.g. "leading-question", "never-collision"
  severity?: string; // "fail" | "fix" | "note"
  issue?: string;
  where?: string;
  proposed_fix?: string;
}

export interface InterviewPlan {
  id: string;
  workspace_id: string;
  round_id: string | null;
  interviewee_id: string | null;
  interviewee_name?: string; // convenience join for the UI
  interviewee_role?: string;
  state: PlanState;
  is_custom_path: boolean;
  mission: PlanMission;
  suggested_questions: SuggestedQuestion[];
  never_list: string[];
  suppressed_flags: { rule: string; kind: string }[];
  // Audited history. Refine entries carry `change`; a nexus_check RETURN entry carries
  // `verdict` + `flags` instead.
  change_log: { at: string; actor: string; change?: string; verdict?: string; flags?: PlanCheckFlag[] }[];
  // Plan-page extras (stage6 mockup): interviewee discovery tag, est-time breakdown,
  // approval stamp, Refine-Plan chat transcript, and the live plan-changes digest.
  interviewee_tag?: { label: string; tone: "first" | "call" | "new" };
  interviewee_note?: string; // e.g. "found during the CEO call — not in public data"
  // Neutral interview topic for the invite copy — a plain area of work, NEVER a claim
  // and never who-said-what (invite-email.md merge field {{INTERVIEW_TOPIC}}).
  interview_topic?: string;
  est_time?: { total_min: number; opening_min: number; topics_min: number; closing_min: number };
  approved_by?: { name: string; at: string };
  refine_chat?: { role: "you" | "nexus"; at: string; text: string; author?: string }[];
  plan_changes?: string[];
  created_at: string;
  updated_at: string;
}

// ── Snapshot card payloads (snapshot_cards.content, typed per card_type) ──────
// Source glyph for a Learned card — where the learning came from (renders as an icon).
export type LearnedSource = "call" | "person" | "message" | "web" | "linkedin";

export interface LearnedContent {
  title: string;
  body: string;
  source: LearnedSource;
  evidence_claim_ids: string[];
}

// A responsibility-only person reference (F34) used both as a suggested person and
// as the "who holds this knowledge" row inside an area.
export interface PersonRef {
  name: string;
  role: string;
  why_line: string;
  // discovery tag: FIRST (interview first) / call-discovered / new-person.
  tag?: { label: string; tone: "first" | "call" | "new" };
  entity_id?: string;
}

// A single belief line inside an area, each carrying its own confidence.
export interface BeliefLine {
  text: string;
  confidence: Confidence;
}

export interface AreaContent {
  rank: number; // display order / priority index (integer, not a pain score)
  title: string;
  pain_band: PainBand;
  owner?: string;
  status: string; // e.g. "Not yet investigated"
  admin_only: boolean; // CEO-private detail (A3 direction asymmetry)
  why_ranked: string;
  summary: string; // one-line shown on the card face
  // Pain signals shown qualitatively — never decimals (F28/A2).
  signals: { frequency: string; emotional_weight: string; mentions: string };
  beliefs: BeliefLine[];
  evidence_claim_ids: string[];
  what_we_dont_know: string[];
  who_holds?: PersonRef;
}

export type SuggestedPersonContent = PersonRef;

export interface ConflictContent {
  title: string;
  kind: "perception_gap" | "worker_vs_worker" | "ceo_vs_floor";
  claim_a: { label: string; claim_id: string };
  claim_b: { label: string; claim_id: string };
  note: string;
}

export type SnapshotCard =
  | { id: string; card_type: "learned"; confidence: Confidence; render_batch: number; content: LearnedContent }
  | { id: string; card_type: "area_to_investigate"; confidence: Confidence; render_batch: number; content: AreaContent }
  | { id: string; card_type: "suggested_person"; confidence: Confidence; render_batch: number; content: SuggestedPersonContent }
  | { id: string; card_type: "conflict_point"; confidence: Confidence; render_batch: number; content: ConflictContent };

// ── Post-Interview Report (Phase 6 / stage8) ─────────────────────────────────
// Verified workflow map from workflow_steps (tool/action/input/output + spine slots),
// perception gaps, key findings, follow-ups, interview-quality score.
export type StepStatus = "verified" | "partial" | "needs_clarification";
export type ToolKind = "whatsapp" | "excel" | "shopify" | "printer" | "notion" | "apify" | "email" | "unknown";

export interface WorkflowStep {
  index: number;
  title: string;
  description?: string;
  tool: { kind: ToolKind; name: string };
  input?: string;
  action?: string;
  output?: string;
  status: StepStatus;
  note?: string; // caveat shown under the card (e.g. "Only top 50 — rest weekly")
  // Step detail (drawer): the respondent's account is PARAPHRASED in client views
  // (F33/A3 — never a verbatim attributed employee quote), plus follow-up gaps.
  captured_from?: string; // person name
  captured_paraphrase?: string;
  confidence?: Confidence;
  unverified_questions?: string[];
}

export interface Report {
  workspace_id: string;
  plan_id: string;
  interviewee_name: string;
  interviewee_role: string;
  status_label: string; // "Interview completed"
  duration_min: number;
  workflow_name: string;
  steps: WorkflowStep[];
  // Cross-interview conflicts this interview is party to (F27 lives here, report-only).
  // Sourced from conflict_points, not the frequently-empty perception_gaps array — a
  // second interview that disagrees with the founder shows up as a ceo_vs_floor conflict,
  // and the report must reflect that instead of claiming there are none.
  conflicts: {
    kind: ConflictKind;
    note: string | null;
    a: { text: string; tag: TrustTag | null };
    b: { text: string; tag: TrustTag | null };
  }[];
  key_findings: { text: string; emphasis?: string }[];
  follow_ups: { text: string }[];
  quality: {
    objectives_captured: number;
    objectives_total: number;
    percent: number;
    partial_dodged: number;
    note: string;
  };
}

// ── Workflow editor (V2 #21) ─────────────────────────────────────────────────
// The claim-derived workflow_steps are never mutated; admin edits are append-only
// overlays and the API returns the folded "effective" workflow. A claim_derived step
// and a manual (admin-invented) one are structurally distinct; a remove is a reversible
// soft_hide; every edit carries provenance. Note: here `tool` is a plain string (the
// editable workflow_steps column), distinct from the report's {kind,name} tool object.
export type WorkflowEditOp =
  | "reorder"
  | "rename"
  | "annotate"
  | "add_manual"
  | "soft_hide"
  | "unhide";

export interface WorkflowEditStamp {
  op: string;
  actor: string;
  at: string;
  prior_value: unknown;
}

export interface WorkflowEditStep {
  step_id: string;
  index: number;
  source: "claim_derived" | "manual";
  hidden: boolean;
  title: string;
  action: string | null;
  tool: string | null;
  input: string | null;
  output: string | null;
  status: StepStatus;
  annotations: { note: string; actor: string; at: string }[];
  edited: boolean;
  provenance: { edits: WorkflowEditStamp[] };
  spine_slots: Record<string, unknown>;
  claim_ids: string[];
}

export interface EffectiveWorkflow {
  workflow_id: string;
  name: string;
  steps: WorkflowEditStep[];
}

export interface WorkflowHistoryEntry {
  overlay_id: string;
  step_id: string | null;
  op: WorkflowEditOp;
  payload: Record<string, unknown>;
  prior_value: unknown;
  actor: string;
  at: string;
}

export interface SopDocument {
  title: string;
  overview: string;
  steps: { n: number; name: string; instructions: string; tool: string | null; note: string | null }[];
  follow_ups: string[];
}

export interface WorkflowSop {
  status: "pending" | "ready";
  document?: SopDocument;
  generated_at?: string;
}

export interface SkillBlueprint {
  workflow_id: string;
  name: string;
  executable: false;
  steps: {
    index: number;
    title: string;
    source: string;
    slots: Record<string, string | null>;
    slots_filled: number;
    slots_total: number;
    unfilled: string[];
  }[];
}
