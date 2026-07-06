"""Agent-vs-agent E2E driver (task #16) — the REAL interviewer (turn engine) interviews a SIMULATED
employee (a respondent persona), then a judge scores whether good interviewing actually happened.

This is the proving-phase keystone: it drives prompts/personas/respondents/*.md against the live
turn engine over the http adapter, produces a transcript, and scores three things from the persona's
hidden SCORER-ONLY checklist + the company's Stage 2 heuristics:
  1. hidden-knowledge extraction — did H1/H2/H3 surface (they're only released under good probing)?
  2. trap resistance — did the interviewer avoid the planted failure-taxonomy baits?
  3. Stage 2 tie-in — score each pre-generated heuristic confirmed / busted / partial from what surfaced.

Usage:
  python -m evals.harness.respondent_sim --persona jewelry-ops-manager --base-url http://localhost:8000 --turns 14

The respondent side is a persona LLM; the interviewer side is the real engine. A12: all personas fictional.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from pathlib import Path

import yaml

from .adapters import HttpInterviewerAdapter

REPO_ROOT = Path(__file__).resolve().parents[2]
PERSONA_DIR = REPO_ROOT / "prompts" / "personas" / "respondents"
HEURISTICS_FILE = REPO_ROOT / "evals" / "e2e" / "stage2-heuristics.yaml"

_SCORER_RE = re.compile(r"<!--\s*SCORER-ONLY.*?-->", re.DOTALL)


def load_persona(name: str) -> tuple[str, str]:
    """Return (respondent_system_prompt, scorer_checklist). The SCORER-ONLY block is stripped from what
    the sim sees (so it can't leak) and returned separately for the judge."""
    path = PERSONA_DIR / (name if name.endswith(".md") else f"{name}.md")
    text = path.read_text()
    scorer = ""
    m = _SCORER_RE.search(text)
    if m:
        scorer = m.group(0)
    sim_prompt = _SCORER_RE.sub("", text).strip()
    return sim_prompt, scorer


class RespondentSim:
    """The simulated employee. Given the conversation so far, produces the respondent's next line."""

    def __init__(self, system_prompt: str, model: str | None = None):
        self.system = system_prompt
        self.model = model or os.environ.get("NEXUS_EVAL_RESPONDENT_MODEL", "claude-sonnet-4-6")

    async def reply(self, history: list[dict]) -> str:
        import anthropic

        # From the respondent's POV the interviewer is the "user" and the respondent is the "assistant".
        msgs = []
        for turn in history:
            role = "user" if turn["speaker"] == "interviewer" else "assistant"
            msgs.append({"role": role, "content": turn["text"]})
        if not msgs or msgs[0]["role"] != "user":
            msgs.insert(0, {"role": "user", "content": "(the interviewer greets you and begins)"})
        client = anthropic.AsyncAnthropic()
        resp = await client.messages.create(
            model=self.model, max_tokens=500, system=self.system, messages=msgs
        )
        return "".join(b.text for b in resp.content if b.type == "text")


async def run_agent_vs_agent(
    persona: str, handoff: dict, base_url: str | None, max_turns: int
) -> list[dict]:
    sim_prompt, _ = load_persona(persona)
    sim = RespondentSim(sim_prompt)
    interviewer = HttpInterviewerAdapter(base_url)

    # bootstrap() mints the session and fires the interviewer's opening turn; grab that opening.
    token = await interviewer.bootstrap(handoff)
    # Re-issue one opening: bootstrap already warmed up; here we start the real exchange with the sim.
    transcript: list[dict] = []
    # The interviewer speaks first — pull its opening by sending an empty/greeting cue via a null turn is
    # already consumed in bootstrap; so we begin with the respondent reacting to being greeted.
    agent_line = await interviewer.turn(token, "(joins the call, ready to begin)")
    transcript.append({"speaker": "interviewer", "text": agent_line})

    for _ in range(max_turns):
        resp_line = await sim.reply(transcript)
        transcript.append({"speaker": "respondent", "text": resp_line})
        agent_line = await interviewer.turn(token, resp_line)
        transcript.append({"speaker": "interviewer", "text": agent_line})
    return transcript


SCORE_SYSTEM = """You score a synthetic interview. You are given (a) the respondent persona's HIDDEN scorer
checklist — its planted hidden-knowledge items H1/H2/H3 and its planted traps, (b) the company's pre-interview
Stage 2 heuristics, and (c) the full transcript of a REAL interviewer talking to this simulated employee.

Judge strictly and cite evidence (a quoted line) for each call.

1. HIDDEN KNOWLEDGE: for each Hn, did it actually SURFACE in the transcript (the respondent revealed it)? A good
   interviewer extracts it via episode-anchoring / exception-hunting; a lazy one never gets it. surfaced: true/false.
2. TRAPS: for each planted trap, did the interviewer TAKE the bait (solutioned / agreed / praised / accepted a
   polished non-answer / lost the skeptic)? taken: true/false — true is BAD.
3. STAGE 2 HEURISTICS: for each heuristic, score confirmed / busted / partial / untouched based ONLY on what the
   transcript actually surfaced — and credit 'confirmed' only if the respondent raised it substantively (not because
   the interviewer led them to it).

Return ONE json object:
{"hidden_knowledge":[{"id":"H1","surfaced":true,"evidence":"..."}],
 "traps":[{"name":"solution-bait","taken":false,"evidence":"..."}],
 "heuristics":[{"id":"h1","outcome":"confirmed|busted|partial|untouched","evidence":"..."}],
 "interview_quality":"one-line verdict","notes":"..."}"""


def _extract_json(text: str) -> dict:
    """Tolerant: prefer a fenced block, else scan from the first '{' for its balanced close.
    Never raises — a malformed judge reply returns an error dict so the transcript is still saved."""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidates = []
    if fenced:
        candidates.append(fenced.group(1))
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    candidates.append(text[start : i + 1])
                    break
    for blob in candidates:
        try:
            return json.loads(blob)
        except json.JSONDecodeError:
            continue
    return {"error": "judge returned unparseable json", "raw": text[:600]}


async def score_run(persona: str, transcript: list[dict], heuristics: list[dict], model: str | None = None) -> dict:
    import anthropic

    _, scorer = load_persona(persona)
    model = model or os.environ.get("NEXUS_EVAL_JUDGE_MODEL", "claude-sonnet-4-6")
    convo = "\n\n".join(f"{t['speaker'].upper()}: {t['text']}" for t in transcript)
    user = (
        f"# Persona hidden scorer checklist\n{scorer}\n\n"
        f"# Stage 2 heuristics (pre-interview)\n{json.dumps(heuristics, ensure_ascii=False, indent=2)}\n\n"
        f"# Transcript\n{convo}\n\n"
        "Return ONLY the json object. Keep each evidence string short (< 20 words) and free of unescaped "
        "quotes or braces."
    )
    client = anthropic.AsyncAnthropic()
    resp = await client.messages.create(model=model, max_tokens=1200, system=SCORE_SYSTEM,
                                         messages=[{"role": "user", "content": user}])
    text = "".join(b.text for b in resp.content if b.type == "text")
    return _extract_json(text)


def _load_company(persona: str) -> dict:
    doc = yaml.safe_load(HEURISTICS_FILE.read_text())
    return doc.get(persona, {})


async def main_async(args) -> int:
    company = _load_company(args.persona)
    handoff = company.get("handoff") or {
        "goal": "Understand how the respondent's core workflow actually happens, day to day.",
        "topics": [{"label": "The main workflow, walked through a specific recent instance", "must_hit": True}],
        "never_list": ["Never reveal anything anyone else said.", "Never propose solutions."],
        "vocabulary": company.get("vocabulary", []),
        "time_budget_min": 30,
    }
    print(f"Agent-vs-agent: interviewer(real) x {args.persona} — {args.turns} turns")
    transcript = await run_agent_vs_agent(args.persona, handoff, args.base_url, args.turns)
    result = await score_run(args.persona, transcript, company.get("heuristics", []))

    hk = result.get("hidden_knowledge", [])
    surfaced = sum(1 for h in hk if h.get("surfaced"))
    traps = result.get("traps", [])
    taken = sum(1 for t in traps if t.get("taken"))
    print(f"\nHidden knowledge surfaced: {surfaced}/{len(hk)}")
    for h in hk:
        print(f"  {'✓' if h.get('surfaced') else '✗'} {h['id']}: {h.get('evidence','')[:80]}")
    print(f"Traps taken (lower better): {taken}/{len(traps)}")
    for t in traps:
        print(f"  {'✗ TOOK' if t.get('taken') else '✓ resisted'} {t.get('name')}")
    print("Stage 2 heuristics:")
    for h in result.get("heuristics", []):
        print(f"  {h.get('id')}: {h.get('outcome')}")
    print(f"Interview quality: {result.get('interview_quality')}")

    if args.json:
        Path(args.json).write_text(json.dumps({"transcript": transcript, "score": result}, ensure_ascii=False, indent=2))
        print(f"\nWrote {args.json}")
    # A clean run = extracted most hidden knowledge and took no traps.
    return 0 if (surfaced >= max(1, len(hk) - 1) and taken == 0) else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Drive the real interviewer against a simulated respondent.")
    p.add_argument("--persona", required=True, help="persona file stem in prompts/personas/respondents/")
    p.add_argument("--base-url", dest="base_url", default=None)
    p.add_argument("--turns", type=int, default=14)
    p.add_argument("--json", default=None)
    args = p.parse_args()
    if args.base_url:
        os.environ["NEXUS_APP_BASE_URL"] = args.base_url
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
