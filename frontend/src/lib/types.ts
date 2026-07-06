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
  // Plan-page extras (stage6 mockup): interviewee discovery tag, est-time breakdown,
  // approval stamp, Refine-Plan chat transcript, and the live plan-changes digest.
  interviewee_tag?: { label: string; tone: "first" | "call" | "new" };
  interviewee_note?: string; // e.g. "found during the CEO call — not in public data"
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
