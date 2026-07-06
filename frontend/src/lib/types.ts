// Shared types — mirror the backend schema (backend/db/migrations/0001_foundation.sql)
// and router responses (backend/app/routers/*). The mock layer (mocks.ts) is shaped
// EXACTLY like these so screens flip to the live API by swapping one import (A15.6).

// ── Trust ladder (F22 + A2): SCRAPED < GUESS < CLAIMED < CONFIRMED < VERIFIED ──
export type TrustTag = "SCRAPED" | "GUESS" | "CLAIMED" | "CONFIRMED" | "VERIFIED";

// ── Snapshot card confidence — the F35 split surfaced to clients ──────────────
// verified = independent agreement · high = single confirmed source ·
// reported = claimed, one voice · scraped = ~20% reference weight (A2).
export type Confidence = "verified" | "high" | "reported" | "scraped";

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
  tag: TrustTag;
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
}

export interface SuggestedQuestion {
  text: string;
  // when a leading question was auto-reformulated, we keep the original for the audit trail.
  reformulated_from?: string;
  topic?: ClaimTopic;
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
  change_log: { at: string; actor: string; change: string }[];
  created_at: string;
  updated_at: string;
}

// ── Snapshot card payloads (snapshot_cards.content, typed per card_type) ──────
export interface LearnedContent {
  title: string;
  body: string;
  evidence_claim_ids: string[];
}

export interface AreaContent {
  title: string;
  pain_band: PainBand;
  why_ranked: string;
  what_we_believe: string;
  evidence_claim_ids: string[];
  what_we_dont_know: string[];
}

export interface SuggestedPersonContent {
  name: string;
  role: string;
  // why-line carries responsibility facts ONLY — no sentiment, no characterization (F34).
  why_line: string;
  entity_id?: string;
}

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
