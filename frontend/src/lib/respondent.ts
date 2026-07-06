// Respondent-side mock (A15.6) — shaped EXACTLY like the by-token session endpoints
// (backend/app/routers/sessions.py) so the interview screen flips to the live API by
// swapping these three functions for api() calls:
//   getSession  → GET  /api/sessions/by-token/{token}
//   takeTurn    → POST /api/sessions/by-token/{token}/turn   (message:null on opening)
//   pauseSession→ POST /api/sessions/by-token/{token}/pause
//
// A12: FICTION. The demo token resolves to Burak's (fictional) interview. Real invite
// tokens are unauthenticated by design (A11.5) and never appear in the workspace app.
//
// NOTE for backend wiring: the consent page needs respondent name / company / admin /
// topic / est-minutes / modality to render its copy. GET /by-token currently returns
// only {id, workspace_id, status, modality, language, resumable_state}; it will need a
// consent_context blob (or those fields) added. The mock carries them under `context`.

import brand from "./brand";

export interface SessionContext {
  respondent_name: string;
  company_name: string;
  admin_name: string;
  interview_topic: string; // neutral area — never a claim (invite/consent merge field)
  est_minutes: number;
  modality: "voice" | "text";
}

export interface RespondentSession {
  id: string;
  status: "pending" | "active" | "paused" | "completed" | "expired";
  modality: "voice" | "text";
  language: string;
  context: SessionContext;
}

export interface TurnResult {
  reply: string;
  turn_index: number;
  elapsed_minutes: number;
  should_offer_pause: boolean;
}

const DEMO_CONTEXT: SessionContext = {
  respondent_name: "Burak",
  company_name: "Bee Goddess",
  admin_name: "Ece Şirin",
  interview_topic: "how daily repricing works",
  est_minutes: 20,
  modality: "text",
};

// Scripted interviewer turns — persona-shaped (states sharing rules at open, warm,
// episodic prompts, offers a pause ~20 min). A stub for the demo; the real turn engine
// (run_interview_turn) replaces it wholesale.
const SCRIPT: string[] = [
  `Hi ${DEMO_CONTEXT.respondent_name} — thanks for making the time. Before we start: this is just about how your work really goes, it isn't a review and nothing is scored. Anything you mention about someone else stays out of what's shared unless you tell me otherwise, and you'll get to see anything attributed to you before it goes anywhere. You can pause whenever you like. To ease in — how would you describe what you do here to someone brand new?`,
  `That's really helpful, thank you. Let's make it concrete — walk me through yesterday morning, from the moment you sat down. What was the very first thing you did?`,
  `Got it. And when the gold rate moved, what happened next — what did you actually do, step by step?`,
  `That paints a clear picture. Tell me about the Excel itself — what lives in it, and how did it come to be the way it is?`,
  `We've covered a lot of good ground, and we're about ${DEMO_CONTEXT.est_minutes} minutes in. We can keep going, or pick this up later on the very same link — whatever's easier for you. Would you like to continue or pause here?`,
  `Thank you — this is exactly the kind of detail that helps. When you're ready, tell me what happens once the new prices are set: how do they reach the website, the boutiques, and the wholesale lists?`,
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export async function getSession(token: string): Promise<RespondentSession> {
  void token; // real impl: GET /api/sessions/by-token/{token}
  return clone({
    id: "sess-demo-burak",
    status: "pending",
    modality: DEMO_CONTEXT.modality,
    language: "en",
    context: DEMO_CONTEXT,
  });
}

// message === null on the opening call — the interviewer speaks first.
export async function takeTurn(
  token: string,
  message: string | null,
  turnIndex: number,
): Promise<TurnResult> {
  void token; void message; // real impl: POST /by-token/{token}/turn {message}
  const idx = Math.min(turnIndex, SCRIPT.length - 1);
  // ~4 min of elapsed conversation per exchange, for the pause-offer threshold.
  const elapsed = Math.min(idx * 4.5, 24);
  return {
    reply: SCRIPT[idx],
    turn_index: idx,
    elapsed_minutes: Math.round(elapsed * 10) / 10,
    should_offer_pause: idx >= 4,
  };
}

export async function pauseSession(
  token: string,
): Promise<{ status: "paused"; resumes_on: string }> {
  void token; // real impl: POST /by-token/{token}/pause
  return { status: "paused", resumes_on: "same link" };
}

// Consent copy assembled from prompts/personas/consent-landing.md with merge fields
// filled. The locked promises here are kept by the interviewer at open/close.
export function consentCopy(ctx: SessionContext) {
  const modality = ctx.modality === "voice" ? "voice call" : "chat";
  return {
    heading: `A quick, honest conversation about ${ctx.interview_topic}`,
    intro: `Hi ${ctx.respondent_name} — thanks for being here. ${ctx.admin_name} at ${ctx.company_name} asked ${brand.product_name} to understand how the work really happens, and your view matters because you're the one who does it. This takes about ${ctx.est_minutes} minutes, and you're in control the whole way.`,
    whatItIs: [
      `It's a ${modality} about how your work actually flows — the real version, not the tidy one.`,
      "There are no right answers, and nothing to prepare.",
      "It is not a performance review. It is not scored. It's about the work, not a judgment of you.",
    ],
    handling: [
      "The conversation is recorded and summarized so your account is captured accurately.",
      "You review before you're named. Before anything is attributed to you by name, you'll see it — and you can change it, take your name off it, or leave it out.",
      "You won't be asked to rate anyone. If an opinion about a person comes up, it's kept out of what's shared unless you explicitly say otherwise.",
      "You can pause anytime and pick up later on the same link.",
    ],
    startAction: "I'm ready — start the conversation",
    consentFinePrint:
      "By starting, you consent to the recording and summary described above. You can stop at any time.",
    modality,
  };
}
