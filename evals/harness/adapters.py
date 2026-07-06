"""Interviewer adapters — how the harness drives a turn of interview.

Two implementations behind one Protocol so the eval cases don't care which is live:

  - HttpInterviewerAdapter — targets the token-keyed text-chat runtime from task #7
    (run_interview_turn). This is the production path; wiring it is a URL swap the day
    the turn endpoint lands (see TURN_PATH / BOOTSTRAP_PATH below — the ONLY coupling).
  - DirectPromptAdapter — calls stage7-interviewer.md directly via Anthropic, no backend.
    Lets the failure-taxonomy + what-if suites run TODAY (and in CI) before the runtime
    exists. Same cases, same judge; only the transport differs.

Endpoint contract this adapter expects from task #7 (documented so backend can confirm):
  POST {base}/sessions/eval-bootstrap   {handoff, modality:"text", language} -> {token}
  POST {base}/sessions/by-token/{token}/turn   {message}                     -> {reply, state}
The bootstrap route is a test-only hook (is_demo session, never a real tenant — A12);
if backend prefers we seed a session row directly instead, only bootstrap() changes.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

REPO_ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = REPO_ROOT / "prompts" / "agents" / "stage7-interviewer.md"
BRAND_PATH = REPO_ROOT / "config" / "brand.json"

# ── The ONLY backend coupling — swap these when task #7 exposes the routes. ──────────
BOOTSTRAP_PATH = "/sessions/eval-bootstrap"
TURN_PATH = "/sessions/by-token/{token}/turn"


class InterviewerAdapter(Protocol):
    """One interview turn. bootstrap() sets up a session from a handoff package;
    turn() sends one respondent message and returns the interviewer's reply text."""

    async def bootstrap(self, handoff: dict) -> str: ...
    async def turn(self, token: str, message: str) -> str: ...


def _load_system_prompt(industry_block: str | None = None) -> str:
    """stage7-interviewer.md with brand + industry markers resolved the way the
    backend's load_prompt does — so the DirectPromptAdapter tests the real prompt."""
    import json

    text = PROMPT_PATH.read_text()
    brand = json.loads(BRAND_PATH.read_text())
    text = text.replace("{{PRODUCT_NAME}}", brand.get("product_name", "the interviewer"))
    text = text.replace("{{INDUSTRY_CALIBRATION}}", industry_block or "")
    return text


def _handoff_block(handoff: dict) -> str:
    """Render a handoff package (objectives, questions, NEVER list, vocabulary, handling
    notes, DoD, time budget) as the runtime context the interviewer receives. NEVER
    includes claim text or quarantined records — the harness only passes safe fields."""
    import json

    safe = {
        k: handoff[k]
        for k in (
            "goal",
            "known_context",
            "topics",
            "definition_of_done",
            "handling_notes",
            "never_list",
            "vocabulary",
            "suggested_questions",
            "time_budget_min",
        )
        if k in handoff
    }
    return "# Handoff package (your whole world for this interview)\n" + json.dumps(
        safe, ensure_ascii=False, indent=2
    )


class DirectPromptAdapter:
    """Drives stage7-interviewer.md directly — no backend needed. bootstrap() stashes
    the handoff + industry block and returns a synthetic token; turn() runs one exchange.
    Single-turn by default (the what-if/taxonomy cases judge the NEXT turn); multi-turn
    state can be added when a case needs it."""

    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("NEXUS_EVAL_INTERVIEWER_MODEL", "claude-sonnet-4-6")
        self._sessions: dict[str, dict] = {}

    async def bootstrap(self, handoff: dict) -> str:
        import uuid

        token = f"direct-{uuid.uuid4().hex[:8]}"
        self._sessions[token] = {
            "system": _load_system_prompt(handoff.get("_industry_block")),
            "handoff": _handoff_block(handoff),
        }
        return token

    async def turn(self, token: str, message: str) -> str:
        import anthropic

        s = self._sessions[token]
        client = anthropic.AsyncAnthropic()
        # Seed a MID-INTERVIEW state so a single cold case-turn doesn't make the model
        # re-run its opening moves (greeting + sharing rules). The real runtime carries
        # conversation history; here we stand in a prior exchange + an explicit note.
        resp = await client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=s["system"],
            messages=[
                {"role": "user", "content": s["handoff"]},
                {
                    "role": "assistant",
                    "content": "Understood — objectives and rules noted. I'll open, then work through them.",
                },
                {
                    "role": "user",
                    "content": (
                        "[HARNESS RUNTIME STATE — the interview is already underway. You have "
                        "ALREADY greeted the respondent and stated the sharing rules; do NOT "
                        "re-introduce yourself or repeat the opening. Any elapsed-time or "
                        "situational detail is in the handoff's scenario note. Respond to the "
                        "respondent's latest turn below as the ongoing interviewer.]\n\n"
                        f"Respondent: {message}"
                    ),
                },
            ],
        )
        return "".join(b.text for b in resp.content if b.type == "text")


class HttpInterviewerAdapter:
    """Targets the task #7 runtime. When the turn endpoint lands, this runs unchanged."""

    def __init__(self, base_url: str | None = None):
        self.base = (base_url or os.environ.get("NEXUS_APP_BASE_URL", "http://localhost:8000")).rstrip("/")

    async def bootstrap(self, handoff: dict) -> str:
        import httpx

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                self.base + BOOTSTRAP_PATH,
                json={"handoff": handoff, "modality": "text", "language": handoff.get("language", "en")},
            )
            r.raise_for_status()
            return r.json()["token"]

    async def turn(self, token: str, message: str) -> str:
        import httpx

        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                self.base + TURN_PATH.format(token=token),
                json={"message": message},
            )
            r.raise_for_status()
            data = r.json()
            # run_interview_turn streams in prod; the eval reads the final assembled reply.
            return data["reply"]


def get_adapter(kind: str) -> InterviewerAdapter:
    if kind == "http":
        return HttpInterviewerAdapter()
    if kind == "direct":
        return DirectPromptAdapter()
    raise ValueError(f"unknown adapter '{kind}' (use 'http' or 'direct')")
