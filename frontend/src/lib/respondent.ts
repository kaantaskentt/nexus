// Respondent-side API client — the interview conversation path. Per Kaan's P0
// directive: the CHAT NEVER uses a mock. Every turn hits the real engine; a failure
// surfaces an honest error, never a scripted reply. These call the by-token session
// endpoints (backend/app/routers/sessions.py, mounted at /api/sessions):
//   getSession  → GET  /api/sessions/by-token/{token}
//   takeTurn    → POST /api/sessions/by-token/{token}/turn   (message:null on opening)
//   pauseSession→ POST /api/sessions/by-token/{token}/pause

import { api } from "./api";
import brand from "./brand";

// Consent-landing display context (invite/consent merge fields). Optional: the live
// GET /by-token does not return it yet, so the consent page renders generic-but-honest
// copy when it's absent. It NEVER drives a conversation reply.
export interface SessionContext {
  respondent_name?: string;
  company_name?: string;
  admin_name?: string;
  interview_topic?: string; // neutral area — never a claim
  est_minutes?: number;
  modality?: "voice" | "text";
}

// One stored turn of the respondent's own conversation (A21 target 4). Verbatim — used
// to render a lossless thread across reloads, drops, and voice/text switches.
export interface TranscriptTurn {
  speaker: "agent" | "respondent";
  text: string;
}

export interface RespondentSession {
  id: string;
  status: "pending" | "active" | "paused" | "completed" | "expired";
  modality: "voice" | "text";
  language: string;
  context?: SessionContext; // present only if the backend supplies consent_context
  transcript: TranscriptTurn[]; // the conversation so far ([] on a fresh session)
  // Admin voice-test mode only (P0-C): a way back to Voice Settings. Never set for
  // real respondents — their view stays chrome-free.
  test_mode?: boolean;
  test_back_path?: string;
  // F7 BETA: this session is the Stage-3 context call with the client (BETA chip).
  context_call?: boolean;
  // SIMPLIFY G: the workspace slug, present ONLY on a context call, so the done page can
  // deep-link the founder to the snapshot their call just built. Never set for employees.
  workspace_slug?: string;
}

export interface TurnResult {
  reply: string;
  turn_index: number;
  elapsed_minutes: number;
  should_offer_pause: boolean;
}

// Raw GET /by-token shape. The backend now returns a `context` blob for the consent
// page; its field names differ slightly from ours, so we map them here.
interface RawSession {
  id: string;
  status: RespondentSession["status"];
  modality: "voice" | "text";
  language: string;
  context?: {
    respondent_first_name?: string | null;
    company_name?: string | null;
    admin_name?: string | null;
    topic?: string | null;
    est_minutes?: number | null;
    modality?: "voice" | "text" | null;
  };
  transcript?: TranscriptTurn[];
  test_mode?: boolean;
  test_back_path?: string;
  context_call?: boolean;
  workspace_slug?: string;
}

const clean = (v?: string | null) => (v == null ? undefined : v);

export async function getSession(token: string): Promise<RespondentSession> {
  const raw = await api<RawSession>(`/api/sessions/by-token/${encodeURIComponent(token)}`);
  const c = raw.context;
  return {
    id: raw.id,
    status: raw.status,
    modality: raw.modality,
    language: raw.language,
    transcript: raw.transcript ?? [],
    test_mode: raw.test_mode || undefined,
    test_back_path: raw.test_back_path || undefined,
    context_call: raw.context_call || undefined,
    workspace_slug: raw.workspace_slug || undefined,
    context: c
      ? {
          respondent_name: clean(c.respondent_first_name),
          company_name: clean(c.company_name),
          admin_name: clean(c.admin_name),
          interview_topic: clean(c.topic),
          est_minutes: c.est_minutes ?? undefined,
          modality: c.modality ?? undefined,
        }
      : undefined,
  };
}

// message === null on the opening call — the interviewer speaks first. The reply is
// whatever the live turn engine returns; there is no fallback.
export async function takeTurn(token: string, message: string | null): Promise<TurnResult> {
  return api<TurnResult>(`/api/sessions/by-token/${encodeURIComponent(token)}/turn`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function pauseSession(
  token: string,
): Promise<{ status: string; resumes_on: string }> {
  return api(`/api/sessions/by-token/${encodeURIComponent(token)}/pause`, { method: "POST" });
}

// Finish the interview: marks the session completed and enqueues the compile that
// produces the report (backend-ontology). Without this, an interview never becomes a
// report — it's the hand-off from the respondent flow to Stage 8.
export async function completeSession(token: string): Promise<{ status: string }> {
  return api(`/api/sessions/by-token/${encodeURIComponent(token)}/complete`, { method: "POST" });
}

// Which VAPI assistant this session's workspace uses (Sprint2-B / #39). Public + token-
// keyed like the other respondent routes; the chosen voice and opener are baked into the
// assistant server-side, so the browser only learns the assistant id to start the call
// with — the private VAPI key never leaves the backend. An uncustomized workspace resolves
// to the shared gender-default, so this is always safe to call before a voice call.
export interface CallVoice {
  assistant_id: string;
  first_message: string | null;
  voice_id: string;
  gender: string;
  speed: number;
}
export async function getCallVoice(token: string): Promise<CallVoice> {
  return api<CallVoice>(`/api/voice-config/by-token/${encodeURIComponent(token)}`);
}

// Consent copy assembled from prompts/personas/consent-landing.md with whatever merge
// fields the session provides; missing fields degrade to neutral, honest phrasing
// (no fabricated names). The locked promises are kept by the interviewer/collector at
// open/close. Two kinds, two promises: an employee `interview` is owed the role-only
// sharing protection (nothing is quoted under their name); a `context` call is the
// founder's own conversation, so the promise is the OPPOSITE — their words build the
// snapshot and are attributed to them as its source (Non-negotiable 2: nothing they say
// here ever reaches an interviewee). `session.context_call` is the kind signal
// (sessions.py sets it for session_kind='context'). Both branches are kept in sync with
// consent-landing.md by the drift guard (evals/consent_copy_sync.py).
export function consentCopy(session: RespondentSession) {
  const ctx = session.context ?? {};
  const name = ctx.respondent_name?.trim() || "there";
  const company = ctx.company_name?.trim();
  const admin = ctx.admin_name?.trim();
  const topic = ctx.interview_topic?.trim() || "your work";
  const minutes = ctx.est_minutes ?? 20;
  const modality = (ctx.modality ?? session.modality) === "voice" ? "voice call" : "chat";

  // Leadership copy — the context call is WITH the client's founder/admin, not an employee
  // under consent protection. The role-only respondent promise is wrong here and must not
  // appear; what this person is owed is honest attribution + the pre-interview promise.
  if (session.context_call) {
    return {
      heading: company
        ? `A working conversation about ${company}`
        : "A working conversation about your company",
      intro: `Hi ${name}, thanks for making the time. This is the context call, where ${brand.product_name} learns how ${company ?? "the company"} actually works, so everything built after this fits the real thing and not a tidy version of it. It takes about ${minutes} minutes, and you can pause anytime.`,
      whatItIsTitle: "What this is",
      whatItIs: [
        `${brand.product_name} is here to understand the company, its goals, and how the work actually gets done. It does not pitch, advise, or solve.`,
        "There are no right answers, and nothing to prepare.",
        "This is the conversation everything downstream is built from, so the more real it is, the better the snapshot.",
      ],
      handlingTitle: `What ${brand.product_name} does with this`,
      handling: [
        "This call is recorded and turned into the first version of your company snapshot: how the work flows, the systems in play, and the open questions worth digging into.",
        "What you share builds your company's snapshot and is attributed to you as its source.",
        `${brand.product_name} may gather relevant public information about the company after the call to round out the picture. Public information is reference only, never treated as verified fact.`,
        "You will see the snapshot before anyone on your team is interviewed. Nothing you say here is ever repeated to an employee.",
        "You can pause anytime and pick up later on the same link.",
      ],
      startAction: "Begin the context call",
      consentFinePrint:
        "By starting, you consent to this call being recorded and turned into your company snapshot, as described above. You can stop at any time.",
      name,
      minutes,
      hasContext: Boolean(session.context),
    };
  }

  const askedBy =
    admin && company
      ? `${admin} at ${company} asked ${brand.product_name}`
      : company
        ? `${company} asked ${brand.product_name}`
        : `${brand.product_name} was asked`;

  // Name the audience honestly: the respondent is owed who-sees-what, not just "shared".
  const audience = company ? `the ${company} team who asked for it` : "the team who asked for it";

  return {
    heading: `A quick, honest conversation about ${topic}`,
    intro: `Hi ${name}, thanks for being here. ${askedBy} to understand how the work really happens, and your view matters because you're the one who does it. This takes about ${minutes} minutes, and you're in control the whole way.`,
    whatItIsTitle: "What this is (and isn't)",
    whatItIs: [
      `It's a ${modality} about how your work actually flows: the real version, not the tidy one.`,
      "There are no right answers, and nothing to prepare.",
      "It is not a performance review. It is not scored. It's about the work, not a judgment of you.",
    ],
    handlingTitle: "How your words are handled",
    handling: [
      "The conversation is recorded and summarized so your account is captured accurately.",
      // Role example kept vertical-neutral (Emre doc-2 P3: "someone in packing" read
      // wrong at a PR agency) — every company has operations.
      `A short summary of how the work flows goes to ${audience}. Pain points are shared by role, like "someone in operations," not by your name.`,
      "Nothing is quoted with your name on it. Your answers are combined with everyone else's before anyone sees conclusions. If there's something you want credited to you, say so, and you'll see exactly how it appears before it goes anywhere.",
      "You won't be asked to rate anyone. If an opinion about a person comes up, it's kept out of what's shared unless you explicitly say otherwise.",
      "You can pause anytime and pick up later on the same link.",
    ],
    startAction: "I'm ready, start the conversation",
    consentFinePrint:
      "By starting, you consent to the recording and summary described above. You can stop at any time.",
    name,
    minutes,
    hasContext: Boolean(session.context),
  };
}
