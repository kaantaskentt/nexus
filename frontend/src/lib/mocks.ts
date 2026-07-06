// Mock layer (A15.6) — fictional Bee Goddess storyline, is_demo=true.
// Every function is shaped EXACTLY like its backend router/view counterpart so a
// screen flips to the live API by swapping `from "@/lib/mocks"` for the api() call.
//   list_workspaces  → GET /workspaces            (routers/workspaces.py)
//   list_claims      → GET /claims/{workspace_id} (client_visible_claims view)
//   list_plans       → GET /plans/{workspace_id}  (routers/plans.py)
//   list_snapshot_cards → snapshot_cards rows (renderer output, Phase 3)
//
// A12 firewall: this is FICTION. Ece / Burak / Selin / Mia and every record here
// are invented for the demo storyline and must never enter a real client tenant.

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
// Sourced from the CEO call (Ece); evidence quotes are her own words, kept
// verbatim with timestamps (A3 — CEO quotes stay; employee quotes are paraphrased).
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
        "Bee Goddess designs symbolic fine jewelry and sells through its own boutiques, wholesale partners, and an online store.",
      evidence_quote:
        "We're a symbolic fine-jewelry house — every piece carries a meaning, and we sell it three ways: our boutiques, wholesale, and the website.",
      evidence_ts: "00:02:14",
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 3,
      supersedes_id: null,
      created_at: "2026-07-04T10:02:14Z",
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
        "Reconciling wholesale orders against production capacity is slow and error-prone at peak season.",
      evidence_quote:
        "Honestly, around the holidays it's… it's a mess — we're matching orders to what production can actually make, on spreadsheets, and things slip.",
      evidence_ts: "00:11:38",
      hedge_signals: ["honestly", "it's… it's", "kind of"],
      sentiment_flag: false,
      approach_note:
        "Founder frames this as her own frustration, not blame — probe the handoff, not the people.",
      mention_count: 4,
      supersedes_id: null,
      created_at: "2026-07-04T10:11:38Z",
    },
    {
      id: "c-003",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-ceo-01",
      scrape_source_id: null,
      speaker_id: "ent-ece",
      subject_id: null,
      kind: "statement",
      topic: "time_or_cost",
      tag: "CLAIMED",
      claim_text:
        "A wholesale order takes about ten days from confirmation to shipment.",
      evidence_quote:
        "From when we confirm a wholesale order to when it ships? Ten days, give or take.",
      evidence_ts: "00:14:02",
      hedge_signals: ["give or take"],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 1,
      supersedes_id: null,
      created_at: "2026-07-04T10:14:02Z",
    },
    {
      id: "c-004",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-op-01",
      scrape_source_id: null,
      speaker_id: "ent-burak",
      subject_id: null,
      kind: "correction",
      topic: "time_or_cost",
      tag: "CONFIRMED",
      claim_text:
        "In practice a wholesale order takes closer to three weeks end-to-end during peak season; casting is the bottleneck.",
      evidence_quote:
        "[paraphrased] Production lead describes peak-season wholesale orders running about three weeks end to end, with casting as the constraint.",
      evidence_ts: "00:22:47",
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 2,
      supersedes_id: "c-003",
      is_paraphrased: true,
      created_at: "2026-07-05T14:22:47Z",
    },
    {
      id: "c-005",
      workspace_id: "ws-bee-goddess",
      session_id: null,
      scrape_source_id: "scrape-web-01",
      speaker_id: null,
      subject_id: null,
      kind: "statement",
      topic: "company_fact",
      tag: "SCRAPED",
      claim_text:
        "The website lists boutiques in Istanbul, London, and New York.",
      evidence_quote: "Boutiques — Istanbul · London · New York",
      evidence_ts: null,
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 1,
      supersedes_id: null,
      created_at: "2026-07-03T09:00:00Z",
    },
    {
      id: "c-006",
      workspace_id: "ws-bee-goddess",
      session_id: "sess-op-01",
      scrape_source_id: null,
      speaker_id: "ent-selin",
      subject_id: null,
      kind: "statement",
      topic: "tool",
      tag: "CONFIRMED",
      claim_text:
        "The online store runs on Shopify; wholesale is tracked separately in spreadsheets.",
      evidence_quote:
        "[paraphrased] E-commerce manager confirms the DTC store is on Shopify while wholesale lives in a separate set of spreadsheets.",
      evidence_ts: "00:08:19",
      hedge_signals: [],
      sentiment_flag: false,
      approach_note: null,
      mention_count: 2,
      supersedes_id: null,
      is_paraphrased: true,
      created_at: "2026-07-05T15:08:19Z",
    },
  ],
  "ws-time-pr": [],
  "ws-marmara": [],
};

// ── Snapshot cards (renderer output, one render_batch per completed round) ────
const SNAPSHOT_CARDS: Record<string, SnapshotCard[]> = {
  "ws-bee-goddess": [
    {
      id: "sc-l1",
      card_type: "learned",
      confidence: "verified",
      render_batch: 1,
      content: {
        title: "Three sales channels, one production line",
        body: "Bee Goddess sells symbolic fine jewelry through owned boutiques, wholesale partners, and a Shopify DTC store — all fed by a single in-house production line.",
        evidence_claim_ids: ["c-001", "c-006"],
      },
    },
    {
      id: "sc-l2",
      card_type: "learned",
      confidence: "high",
      render_batch: 1,
      content: {
        title: "Wholesale and DTC live in separate systems",
        body: "The direct-to-consumer store runs on Shopify; wholesale orders are tracked in standalone spreadsheets, with no shared view of production capacity.",
        evidence_claim_ids: ["c-006"],
      },
    },
    {
      id: "sc-l3",
      card_type: "learned",
      confidence: "scraped",
      render_batch: 1,
      content: {
        title: "Boutiques in three cities",
        body: "Public listings show boutiques in Istanbul, London, and New York. Not yet confirmed on a call — treat as reference until verified.",
        evidence_claim_ids: ["c-005"],
      },
    },
    {
      id: "sc-a1",
      card_type: "area_to_investigate",
      confidence: "high",
      render_batch: 1,
      content: {
        title: "Wholesale-to-production reconciliation at peak season",
        pain_band: "high",
        why_ranked:
          "Raised four times by the founder, each time unprompted, and tied to revenue timing at the holidays.",
        what_we_believe:
          "Orders are matched to production capacity by hand on spreadsheets, and commitments slip when casting is the constraint.",
        evidence_claim_ids: ["c-002", "c-004"],
        what_we_dont_know: [
          "Who owns the order-to-production handoff day to day?",
          "How far ahead is capacity actually visible?",
          "What happens today when an order can't be met on time?",
        ],
      },
    },
    {
      id: "sc-a2",
      card_type: "area_to_investigate",
      confidence: "reported",
      render_batch: 1,
      content: {
        title: "Quoted lead times may not match reality",
        pain_band: "moderate",
        why_ranked:
          "The founder's ten-day figure is already contradicted by a production account of roughly three weeks at peak.",
        what_we_believe:
          "Customer-facing lead times are set from an optimistic baseline that peak-season casting can't sustain.",
        evidence_claim_ids: ["c-003", "c-004"],
        what_we_dont_know: [
          "Which lead time do wholesale partners actually get quoted?",
          "Is the gap seasonal or year-round?",
        ],
      },
    },
    {
      id: "sc-p1",
      card_type: "suggested_person",
      confidence: "high",
      render_batch: 1,
      content: {
        name: "Burak Yılmaz",
        role: "Production Lead",
        why_line:
          "Owns casting and the production schedule — the step named as the peak-season bottleneck.",
        entity_id: "ent-burak",
      },
    },
    {
      id: "sc-p2",
      card_type: "suggested_person",
      confidence: "high",
      render_batch: 1,
      content: {
        name: "Selin Kaya",
        role: "E-commerce Manager",
        why_line:
          "Runs the Shopify store and the wholesale spreadsheets — sits on both sides of the reconciliation gap.",
        entity_id: "ent-selin",
      },
    },
    {
      id: "sc-p3",
      card_type: "suggested_person",
      confidence: "reported",
      render_batch: 1,
      content: {
        name: "Mia Rossi",
        role: "Wholesale & Export Manager",
        why_line:
          "Named as the point of contact for wholesale partners and the lead times quoted to them.",
        entity_id: "ent-mia",
      },
    },
    {
      id: "sc-c1",
      card_type: "conflict_point",
      confidence: "verified",
      render_batch: 1,
      content: {
        title: "Wholesale lead time: 10 days vs ~3 weeks",
        kind: "perception_gap",
        claim_a: { label: "Founder: about ten days, confirmation to shipment", claim_id: "c-003" },
        claim_b: { label: "Production: closer to three weeks at peak, casting-bound", claim_id: "c-004" },
        note: "A perception gap between the executive baseline and the floor. Held for the report; surfaced here as golden data for the next round.",
      },
    },
  ],
  "ws-time-pr": [],
  "ws-marmara": [],
};

// ── Interview plans (lifecycle states across the machine) ─────────────────────
const PLANS: Record<string, InterviewPlan[]> = {
  "ws-bee-goddess": [
    {
      id: "plan-burak",
      workspace_id: "ws-bee-goddess",
      round_id: "round-2",
      interviewee_id: "ent-burak",
      interviewee_name: "Burak Yılmaz",
      interviewee_role: "Production Lead",
      state: "APPROVED",
      is_custom_path: false,
      mission: {
        goal: "Understand how wholesale orders move through production at peak season, and where commitments slip.",
        known_context: [
          "Bee Goddess sells through boutiques, wholesale, and a Shopify DTC store.",
          "Wholesale orders are reconciled to production capacity on spreadsheets.",
          "Casting has been named as the peak-season bottleneck.",
        ],
        topics: [
          {
            label: "The order-to-production handoff",
            must_hit: true,
            detail: "How a confirmed wholesale order becomes a production commitment, step by step.",
          },
          {
            label: "Casting capacity and how far ahead it's visible",
            must_hit: true,
            detail: "What sets the ceiling, and when the team knows they'll miss it.",
          },
          {
            label: "What happens when an order can't be met on time",
            must_hit: true,
          },
          {
            label: "Tools and handoffs between production and e-commerce",
            must_hit: false,
          },
          {
            label: "A recent peak season, walked through end to end",
            must_hit: false,
            detail: "Backward recall of a specific holiday run for episodic detail.",
          },
        ],
        definition_of_done: [
          "The order-to-production handoff is documented step by step with owners.",
          "The real peak-season lead time is established from a specific example.",
          "The failure path (missed commitment) is understood, not just named.",
        ],
        handling_notes: [
          "The founder frames reconciliation as her own frustration — do not import blame toward production.",
          "Use the respondent's own vocabulary for steps; do not introduce e-commerce jargon.",
        ],
      },
      suggested_questions: [
        {
          text: "Walk me through what happens the moment a wholesale order is confirmed — what's the very first thing that happens on your side?",
          topic: "process_step",
        },
        {
          text: "Think of the last holiday season. Can you take me through one order from confirmation to when it shipped?",
          topic: "process_step",
        },
        {
          text: "When you can see an order won't be ready in time, what happens next?",
          reformulated_from:
            "Don't you find it stressful when orders can't be met on time?",
          topic: "pain",
        },
      ],
      never_list: [
        "Never repeat or hint at anything the founder said about production or people.",
        "Never propose solutions or improvements — capture how it works today.",
        "Never characterize a named colleague; ask about the work, not the person.",
      ],
      suppressed_flags: [],
      change_log: [
        { at: "2026-07-05T16:40:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
        { at: "2026-07-05T16:52:00Z", actor: "nexus_team", change: "Reformulated a leading question on missed orders into an open form." },
        { at: "2026-07-05T17:05:00Z", actor: "nexus_team", change: "Nexus check passed — no credential requests, no leading questions remaining." },
        { at: "2026-07-05T17:20:00Z", actor: "admin", change: "Approved in the initial batch." },
      ],
      created_at: "2026-07-05T16:40:00Z",
      updated_at: "2026-07-05T17:20:00Z",
    },
    {
      id: "plan-selin",
      workspace_id: "ws-bee-goddess",
      round_id: "round-2",
      interviewee_id: "ent-selin",
      interviewee_name: "Selin Kaya",
      interviewee_role: "E-commerce Manager",
      state: "SENT",
      is_custom_path: false,
      mission: {
        goal: "Map how DTC and wholesale data stay (or fail to stay) in sync across Shopify and the spreadsheets.",
        known_context: [
          "The DTC store runs on Shopify.",
          "Wholesale is tracked in separate spreadsheets.",
        ],
        topics: [
          { label: "The two systems and what moves between them", must_hit: true },
          { label: "Where numbers are re-keyed by hand", must_hit: true },
          { label: "Reporting the founder asks for", must_hit: false },
        ],
        definition_of_done: [
          "Every manual data handoff between Shopify and wholesale is named.",
          "The reconciliation step is documented from her side.",
        ],
        handling_notes: [
          "Use her tool names verbatim.",
        ],
      },
      suggested_questions: [
        {
          text: "When a wholesale order comes in, where does it get recorded, and what do you do with it from there?",
          topic: "process_step",
        },
      ],
      never_list: [
        "Never reveal anything the founder or the production lead said.",
        "Never propose a system or a fix.",
      ],
      suppressed_flags: [],
      change_log: [
        { at: "2026-07-05T16:41:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
        { at: "2026-07-05T17:10:00Z", actor: "admin", change: "Approved in the initial batch." },
        { at: "2026-07-05T17:12:00Z", actor: "system", change: "Invite sent." },
      ],
      created_at: "2026-07-05T16:41:00Z",
      updated_at: "2026-07-05T17:12:00Z",
    },
    {
      id: "plan-mia",
      workspace_id: "ws-bee-goddess",
      round_id: "round-2",
      interviewee_id: "ent-mia",
      interviewee_name: "Mia Rossi",
      interviewee_role: "Wholesale & Export Manager",
      state: "DRAFT",
      is_custom_path: false,
      mission: {
        goal: "Learn what lead times wholesale partners are actually quoted, and how commitments are set.",
        known_context: [
          "Founder quotes ~10 days; production describes ~3 weeks at peak.",
        ],
        topics: [
          { label: "What lead time partners are told", must_hit: true },
          { label: "How a commitment date is chosen", must_hit: true },
        ],
        definition_of_done: [
          "The quoted-vs-actual lead time gap is grounded in her workflow.",
        ],
        handling_notes: [],
      },
      suggested_questions: [],
      never_list: [
        "Never reveal the founder's or production's stated lead times — ask what she quotes, cold.",
      ],
      suppressed_flags: [],
      change_log: [
        { at: "2026-07-05T16:42:00Z", actor: "system", change: "Plan drafted from the compiled CEO session." },
      ],
      created_at: "2026-07-05T16:42:00Z",
      updated_at: "2026-07-05T16:42:00Z",
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

// A claim lookup so evidence rails can resolve claim_ids → records.
export async function get_claim(claim_id: string): Promise<ClaimRecord | undefined> {
  for (const rows of Object.values(CLAIMS)) {
    const hit = rows.find((c) => c.id === claim_id);
    if (hit) return clone(hit);
  }
  return undefined;
}
