// Mock layer (A15.6) — the canonical Bee Goddess demo storyline as shown in the
// stage5/stage6 mockups (daily repricing · content approval · Burak's Excel · Mia ·
// Selin). Every function is shaped EXACTLY like its backend router/view counterpart
// so a screen flips to the live API by swapping `from "@/lib/mocks"` for api().
//   list_workspaces     → GET /workspaces            (routers/workspaces.py)
//   list_claims         → GET /claims/{workspace_id} (client_visible_claims view)
//   list_plans          → GET /plans/{workspace_id}  (routers/plans.py)
//   list_snapshot_cards → snapshot_cards rows (renderer output, Phase 3)
//
// A12 firewall: this is FICTION. Ece Şirin / Mia / Burak / Selin and every record
// here are invented for the demo and must never enter a real client tenant.

import type {
  ClaimRecord,
  InterviewPlan,
  SnapshotCard,
  Workspace,
} from "./types";

// ── Workspaces (the picker) ──────────────────────────────────────────────────
const WORKSPACES: Workspace[] = [
  {
    id: "ws-bee-goddess",
    name: "Bee Goddess",
    slug: "bee-goddess",
    industry: "jewelry",
    is_demo: true,
    config: {
      founder: "Ece Şirin",
      founder_role: "Founder & Creative Director",
      tagline: "Fine jewelry — handcrafted in Istanbul",
      starting_focus: "daily repricing → content approval",
      source: "CEO Discovery Call + Website Scan",
      approved_for_pilot: true,
    },
  },
  {
    id: "ws-time-pr",
    name: "Time PR",
    slug: "time-pr",
    industry: "communications",
    is_demo: false,
  },
  {
    id: "ws-marmara",
    name: "Marmara Hotels Taksim",
    slug: "marmara-taksim",
    industry: "hospitality",
    is_demo: false,
  },
];

// ── Claim records (client_visible_claims — quarantined rows already excluded) ──
// From the CEO discovery call (Ece's own words, verbatim with timestamps — A3) plus
// one scraped web fact. Employee-sourced records would be paraphrased (F33); none
// exist yet at the discovery stage.
const CLAIMS: Record<string, ClaimRecord[]> = {
  "ws-bee-goddess": [
    {
      id: "c-001",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "statement",
      topic: "company_fact",
      tag: "CONFIRMED",
      claim_text:
        "Bee Goddess is a fine-jewelry brand handcrafted in Istanbul, selling through its website, boutiques, and wholesale partners.",
      evidence_quote:
        "We make symbolic fine jewelry, all handcrafted here in Istanbul — and we sell it on the site, in the boutiques, and to wholesale.",
      evidence_ts: "00:41",
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 2,
      supersedes_id: null,
      created_at: "2026-07-04T10:00:41Z",
    },
    {
      id: "c-002",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "admission",
      topic: "pain",
      tag: "CLAIMED",
      claim_text:
        "Daily repricing is manual — every morning the prices are redone by hand in a personal Excel as the gold rate moves.",
      evidence_quote:
        "He has his Excel, he's had it for years. Takes him, sanırım, maybe two hours every morning.",
      evidence_ts: "02:52",
      hedge_signals: ["sanırım", "maybe"],
      sentiment_flag: false,
      approach_note: "Founder describes the work, not the person — keep it about the process.",
      mention_count: 3,
      supersedes_id: null,
      created_at: "2026-07-04T10:02:52Z",
    },
    {
      id: "c-003",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "admission",
      topic: "pain",
      tag: "CLAIMED",
      claim_text:
        "Every social post needs founder approval and can sit three to four days before it goes out.",
      evidence_quote:
        "Everything goes through me. Every post… sometimes it sits with me three, four days, I know, I know.",
      evidence_ts: "04:47",
      hedge_signals: ["I know, I know"],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 2,
      supersedes_id: null,
      created_at: "2026-07-04T10:04:47Z",
    },
    {
      id: "c-004",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "statement",
      topic: "process_step",
      tag: "CLAIMED",
      claim_text:
        "All day-to-day operations run through a single WhatsApp group, Müşteri Takip — sales, complaints, and price updates.",
      evidence_quote:
        "Müşteri Takip group. Everything happens there. Sales, complaints, Burak's price updates…",
      evidence_ts: "06:18",
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 2,
      supersedes_id: null,
      created_at: "2026-07-04T10:06:18Z",
    },
    {
      id: "c-005",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "statement",
      topic: "time_or_cost",
      tag: "GUESS",
      claim_text:
        "Repricing is estimated at roughly two hours a day, applied separately across three channels.",
      evidence_quote:
        "…the website prices, the boutique tags, the wholesale lists — ayrı ayrı, all separate.",
      evidence_ts: "07:30",
      hedge_signals: ["maybe", "I think"],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 1,
      supersedes_id: null,
      created_at: "2026-07-04T10:07:30Z",
    },
    {
      id: "c-006",
      workspace_id: "ws-bee-goddess",
      session_id: null,
      scrape_source_id: "scrape-web-01",
      speaker_id: null,
      subject_id: null,
      kind: "statement",
      topic: "company_fact",
      tag: "SCRAPED",
      claim_text: "Public listings show boutiques in Istanbul, London, and New York.",
      evidence_quote: "Boutiques — Istanbul · London · New York",
      evidence_ts: null,
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 1,
      supersedes_id: null,
      created_at: "2026-07-03T09:00:00Z",
    },
  ],
  "ws-time-pr": [],
  "ws-marmara": [],
};

// ── Snapshot cards (renderer output, one render_batch per completed round) ────
const SNAPSHOT_CARDS: Record<string, SnapshotCard[]> = {
  "ws-bee-goddess": [
    // What Nexus Learned (source glyph + statement + confidence)
    {
      id: "sc-l1",
      card_type: "learned",
      confidence: "reported",
      render_batch: 1,
      content: {
        title: "Prices re-done manually every morning — gold moves daily",
        body: "The owner reprices by hand each morning in a personal Excel as the gold rate shifts, then pushes the new prices out.",
        source: "call",
        evidence_claim_ids: ["c-002"],
      },
    },
    {
      id: "sc-l2",
      card_type: "learned",
      confidence: "reported",
      render_batch: 1,
      content: {
        title: "Every post needs founder approval — sits 3–4 days",
        body: "Content waits on the founder before it can go out; posts can sit three to four days in the queue.",
        source: "person",
        evidence_claim_ids: ["c-003"],
      },
    },
    {
      id: "sc-l3",
      card_type: "learned",
      confidence: "reported",
      render_batch: 1,
      content: {
        title: "Operations run inside one WhatsApp group (Müşteri Takip)",
        body: "Sales, complaints, and price updates all flow through a single WhatsApp group rather than a system.",
        source: "message",
        evidence_claim_ids: ["c-004"],
      },
    },
    {
      id: "sc-l4",
      card_type: "learned",
      confidence: "guess",
      render_batch: 1,
      content: {
        title: "Repricing takes ~2 hrs/day across 3 separate channels",
        body: "An unverified estimate from the call — website, boutique tags, and wholesale lists are each priced separately.",
        source: "call",
        evidence_claim_ids: ["c-005"],
      },
    },
    // Areas to Investigate (ranked, pain band, drawer payload)
    {
      id: "sc-a1",
      card_type: "area_to_investigate",
      confidence: "high",
      render_batch: 1,
      content: {
        rank: 1,
        title: "Daily repricing workflow",
        pain_band: "severe",
        owner: "Burak",
        status: "Not yet investigated",
        admin_only: true,
        why_ranked:
          "Raised repeatedly and unprompted on the discovery call; single-owner, daily, and directly tied to revenue.",
        summary:
          "Manual, daily, single-owner (Burak's personal Excel), applied separately to web, boutique and wholesale.",
        signals: {
          frequency: "Daily",
          emotional_weight: "Strong language in call",
          mentions: "3× unprompted",
        },
        beliefs: [
          { text: "Prices re-done manually every morning — gold moves daily", confidence: "reported" },
          { text: "Runs on Burak's personal Excel, maintained for years", confidence: "reported" },
          { text: "Takes ~2 hours each morning (unverified estimate)", confidence: "guess" },
          { text: "Applied separately to web, boutiques, and wholesale", confidence: "reported" },
        ],
        evidence_claim_ids: ["c-002", "c-005"],
        what_we_dont_know: [
          "Actual time it takes (the current number is a guess)",
          "What's inside the Excel — the logic, and who else can use it",
          "How prices reach each channel, step by step",
          "What happens when gold moves mid-day",
          "What happens when Burak is away",
        ],
        who_holds: {
          name: "Burak",
          role: "Pricing & Operations",
          why_line: "Sole owner of the daily repricing workflow.",
          tag: { label: "call-discovered", tone: "call" },
        },
      },
    },
    {
      id: "sc-a2",
      card_type: "area_to_investigate",
      confidence: "high",
      render_batch: 1,
      content: {
        rank: 2,
        title: "Content approval bottleneck",
        pain_band: "severe",
        owner: "Ece Şirin",
        status: "Not yet investigated",
        admin_only: true,
        why_ranked:
          "The founder names herself as the bottleneck; posts sit three to four days waiting on her.",
        summary: "All content waits on the founder; an agency attempt ended March 2026.",
        signals: {
          frequency: "Per post",
          emotional_weight: "Self-aware frustration",
          mentions: "2×",
        },
        beliefs: [
          { text: "Every post is approved by the founder before it ships", confidence: "reported" },
          { text: "Posts can sit three to four days in the queue", confidence: "reported" },
          { text: "An outside agency attempt ended in March 2026", confidence: "guess" },
        ],
        evidence_claim_ids: ["c-003"],
        what_we_dont_know: [
          "Where content prep actually starts, and who drafts it",
          "What the founder is checking for when she approves",
          "Why the agency attempt ended",
        ],
        who_holds: {
          name: "Mia",
          role: "Content Manager",
          why_line: "Prepares and schedules content across channels.",
          tag: { label: "FIRST", tone: "first" },
        },
      },
    },
    {
      id: "sc-a3",
      card_type: "area_to_investigate",
      confidence: "reported",
      render_batch: 1,
      content: {
        rank: 3,
        title: "Online returns process",
        pain_band: "high",
        owner: "Selin",
        status: "Not yet investigated",
        admin_only: true,
        why_ranked: "Completely unmapped — the founder does not know how it works today.",
        summary: "Completely unmapped — founder doesn't know how it works. Owner: Selin.",
        signals: {
          frequency: "Unknown",
          emotional_weight: "Uncertainty",
          mentions: "1×",
        },
        beliefs: [
          { text: "Returns are handled online by Selin", confidence: "reported" },
          { text: "The founder has no visibility into the steps", confidence: "reported" },
        ],
        evidence_claim_ids: [],
        what_we_dont_know: [
          "The whole flow, start to finish",
          "How often returns happen and why",
          "What tools or messages the process runs on",
        ],
        who_holds: {
          name: "Selin",
          role: "E-commerce / Returns",
          why_line: "Runs the online store and owns the returns flow.",
          tag: { label: "call-discovered", tone: "call" },
        },
      },
    },
    {
      id: "sc-a4",
      card_type: "area_to_investigate",
      confidence: "reported",
      render_batch: 1,
      content: {
        rank: 4,
        title: "Multi-channel price sync",
        pain_band: "high",
        owner: "Burak",
        status: "Not yet investigated",
        admin_only: true,
        why_ranked: "The same price change is entered separately per channel — an inconsistency risk.",
        summary: "Same price change entered separately per channel; inconsistency risk.",
        signals: {
          frequency: "Daily",
          emotional_weight: "Implied risk",
          mentions: "2×",
        },
        beliefs: [
          { text: "Web, boutique tags, and wholesale lists are priced separately", confidence: "reported" },
          { text: "No single source of truth for the current price", confidence: "guess" },
        ],
        evidence_claim_ids: ["c-005"],
        what_we_dont_know: [
          "Whether the channels ever disagree in practice",
          "How a mismatch would be caught today",
        ],
        who_holds: {
          name: "Burak",
          role: "Pricing & Operations",
          why_line: "Enters the price changes into each channel.",
          tag: { label: "call-discovered", tone: "call" },
        },
      },
    },
    // Suggested People (why-lines carry responsibility facts only — F34)
    {
      id: "sc-p1",
      card_type: "suggested_person",
      confidence: "high",
      render_batch: 1,
      content: {
        name: "Mia",
        role: "Content Manager",
        why_line: "Prepares and schedules content across channels; closest to the day-to-day.",
        tag: { label: "FIRST", tone: "first" },
        entity_id: "ent-mia",
      },
    },
    {
      id: "sc-p2",
      card_type: "suggested_person",
      confidence: "high",
      render_batch: 1,
      content: {
        name: "Burak",
        role: "Pricing & Operations",
        why_line: "Sole owner of the daily repricing workflow.",
        tag: { label: "call-discovered", tone: "call" },
        entity_id: "ent-burak",
      },
    },
    {
      id: "sc-p3",
      card_type: "suggested_person",
      confidence: "reported",
      render_batch: 1,
      content: {
        name: "Selin",
        role: "E-commerce / Returns",
        why_line: "Runs the online store and owns the returns flow.",
        tag: { label: "call-discovered", tone: "call" },
        entity_id: "ent-selin",
      },
    },
    // Conflict Points (first-class — A3). None yet at pure discovery; appears after
    // the first round when a floor account contradicts the founder's baseline.
  ],
  "ws-time-pr": [],
  "ws-marmara": [],
};

// ── Interview plans (lifecycle states across the machine) ─────────────────────
const PLANS: Record<string, InterviewPlan[]> = {
  "ws-bee-goddess": [
    {
      id: "plan-mia",
      workspace_id: "ws-bee-goddess",
      round_id: "round-1",
      interviewee_id: "ent-mia",
      interviewee_name: "Mia",
      interviewee_role: "Content Manager",
      interviewee_tag: { label: "FIRST", tone: "first" },
      interviewee_note: "Named by the founder as closest to the day-to-day work.",
      state: "SENT",
      is_custom_path: false,
      mission: {
        goal: "Map how content actually gets prepared and moved toward approval, in Mia's words.",
        known_context: [
          "Every post needs founder approval and can sit 3–4 days.",
          "An outside agency attempt ended in March 2026.",
        ],
        topics: [
          { label: "Her role and a normal week, in her words", must_hit: true },
          { label: "How a post goes from idea to ready-for-approval", must_hit: true },
          { label: "Where things wait, and why", must_hit: true },
          { label: "What the agency attempt was, and how it ended", must_hit: false },
        ],
        definition_of_done: [
          "The content flow is documented from draft to approval with owners and waits.",
        ],
        handling_notes: ["Open warmly; she is described as close to the work and forthcoming."],
      },
      suggested_questions: [
        { text: "Tell me about what you do here — how would you describe your week to someone new?", topic: "process_step" },
      ],
      never_list: [
        "Never reveal what the founder said about approvals or people.",
        "Never propose a fix or a tool.",
      ],
      suppressed_flags: [],
      est_time: { total_min: 20, opening_min: 3, topics_min: 14, closing_min: 3 },
      approved_by: { name: "Ece Şirin", at: "10:18" },
      change_log: [
        { at: "2026-07-05T16:30:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
        { at: "2026-07-05T16:55:00Z", actor: "admin", change: "Approved as the first interview." },
        { at: "2026-07-05T16:58:00Z", actor: "system", change: "Invite sent." },
      ],
      created_at: "2026-07-05T16:30:00Z",
      updated_at: "2026-07-05T16:58:00Z",
    },
    {
      id: "plan-burak",
      workspace_id: "ws-bee-goddess",
      round_id: "round-1",
      interviewee_id: "ent-burak",
      interviewee_name: "Burak",
      interviewee_role: "Pricing & Operations",
      interviewee_tag: { label: "call-discovered", tone: "call" },
      interviewee_note: "found during the CEO call — not in public data",
      state: "APPROVED",
      is_custom_path: false,
      mission: {
        goal:
          "Understand how daily repricing actually works — from the morning gold rate to updated prices across all channels.",
        known_context: [
          "Repricing is manual and daily.",
          "Runs on a personal Excel.",
          "Time estimate unverified.",
        ],
        topics: [
          { label: "His role and a normal morning, in his words", must_hit: true },
          { label: "The repricing flow start to finish (last real morning walkthrough)", must_hit: true },
          { label: "Actual time it takes (unverified — currently a guess)", must_hit: true },
          { label: "The Excel: what it holds, who else can use it", must_hit: true },
          { label: "How prices reach each channel (web, boutiques, wholesale)", must_hit: true },
          { label: "What happens when gold moves mid-day", must_hit: false },
          { label: "What happens when he's sick or away", must_hit: false },
          { label: "His own frustrations, in his words", must_hit: false },
        ],
        definition_of_done: [
          "Steps, tools, decision rules, exceptions, and time captured — plus at least one real morning told as a story.",
        ],
        handling_notes: [
          "Approach gently — may be uneasy around new systems.",
          "Open with respect for his experience. Avoid the word 'automation'.",
        ],
      },
      suggested_questions: [
        { text: "Tell me about what you do here — how would you describe your job to someone new?", topic: "process_step" },
        { text: "Walk me through yesterday morning — from sitting down to the first prices going live.", topic: "process_step" },
        { text: "When the gold rate moves, what actually happens next?", topic: "process_step" },
        { text: "Tell me about the Excel — what lives in it, and how did it come to be?", topic: "tool" },
        { text: "How do the new prices get to the website, the boutiques, and the wholesale lists?", topic: "process_step" },
      ],
      never_list: [
        "Never repeat or hint at anything the founder said.",
        "Never propose solutions or improvements — capture how it works today.",
        "Never use the word 'automation'.",
      ],
      suppressed_flags: [],
      est_time: { total_min: 20, opening_min: 3, topics_min: 14, closing_min: 3 },
      approved_by: { name: "Ece Şirin", at: "10:24" },
      refine_chat: [
        { role: "you", at: "10:21 AM", author: "ES", text: "Also ask what happens when he's on holiday — last summer was chaos." },
        { role: "nexus", at: "10:21 AM", text: "Added a coverage question: what happens when you're away. Marked nice-to-have." },
        { role: "you", at: "10:22 AM", author: "ES", text: "Don't push him on timing, he gets defensive." },
        { role: "nexus", at: "10:22 AM", text: "Understood — timing stays a single open question, no follow-up pressure. Added to handling notes." },
      ],
      plan_changes: [
        "Added holiday-coverage question",
        "Timing marked single-attempt",
        "Channel-sync questions expanded",
      ],
      change_log: [
        { at: "2026-07-05T16:31:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
        { at: "2026-07-05T16:40:00Z", actor: "admin", change: "Refined via chat: holiday coverage + timing sensitivity." },
        { at: "2026-07-05T17:24:00Z", actor: "admin", change: "Approved." },
      ],
      created_at: "2026-07-05T16:31:00Z",
      updated_at: "2026-07-05T17:24:00Z",
    },
    {
      id: "plan-selin",
      workspace_id: "ws-bee-goddess",
      round_id: "round-1",
      interviewee_id: "ent-selin",
      interviewee_name: "Selin",
      interviewee_role: "E-commerce / Returns",
      interviewee_tag: { label: "call-discovered", tone: "call" },
      interviewee_note: "found during the CEO call — not in public data",
      state: "DRAFT",
      is_custom_path: false,
      mission: {
        goal: "Map the online returns flow end to end — the area the founder can't see.",
        known_context: ["Returns are handled online by Selin.", "The founder has no visibility into the steps."],
        topics: [
          { label: "The returns flow start to finish", must_hit: true },
          { label: "How often returns happen and why", must_hit: true },
          { label: "The tools and messages it runs on", must_hit: false },
        ],
        definition_of_done: ["The returns flow is documented from request to resolution."],
        handling_notes: [],
      },
      suggested_questions: [],
      never_list: ["Never reveal the founder's or anyone else's account — ask her cold."],
      suppressed_flags: [],
      est_time: { total_min: 20, opening_min: 3, topics_min: 14, closing_min: 3 },
      change_log: [
        { at: "2026-07-05T16:32:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
      ],
      created_at: "2026-07-05T16:32:00Z",
      updated_at: "2026-07-05T16:32:00Z",
    },
  ],
  "ws-time-pr": [],
  "ws-marmara": [],
};

// ── Router-shaped accessors ──────────────────────────────────────────────────
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export async function list_workspaces(): Promise<Workspace[]> {
  return clone(WORKSPACES);
}

export async function get_workspace(slug: string): Promise<Workspace | undefined> {
  return clone(WORKSPACES.find((w) => w.slug === slug));
}

export async function list_claims(
  workspace_id: string,
  topic?: string,
): Promise<ClaimRecord[]> {
  const rows = CLAIMS[workspace_id] ?? [];
  return clone(topic ? rows.filter((r) => r.topic === topic) : rows);
}

export async function list_snapshot_cards(
  workspace_id: string,
): Promise<SnapshotCard[]> {
  return clone(SNAPSHOT_CARDS[workspace_id] ?? []);
}

export async function list_plans(workspace_id: string): Promise<InterviewPlan[]> {
  return clone(PLANS[workspace_id] ?? []);
}

export async function get_plan(plan_id: string): Promise<InterviewPlan | undefined> {
  for (const rows of Object.values(PLANS)) {
    const hit = rows.find((p) => p.id === plan_id);
    if (hit) return clone(hit);
  }
  return undefined;
}

export async function get_claim(claim_id: string): Promise<ClaimRecord | undefined> {
  for (const rows of Object.values(CLAIMS)) {
    const hit = rows.find((c) => c.id === claim_id);
    if (hit) return clone(hit);
  }
  return undefined;
}
