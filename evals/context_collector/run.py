"""Runner for the Stage-3 context-collector eval suite (F7).

Follows the repo's suite-specific-runner precedent (evals/harness/plan_runner.py): the
context-collector is a persona, not a single-shot prompt, but every case here judges the
agent's NEXT turn given a CEO turn plus mid-call state — so a single exchange per case is
the right unit, exactly like the interviewer's DirectPromptAdapter drives its what-if cases.

This runner is deliberately self-contained under evals/context_collector/ (it does not touch
the interviewer runner or its interviewee-shaped DEFAULT_HANDOFF, which is the wrong handoff
for a CEO call). It loads prompts/agents/stage3-context-collector.md with brand + industry
markers resolved the way the backend's load_prompt does, seeds a MID-CALL state so a cold
case-turn does not re-run the opening arc, generates one reply, and judges it against
pass_if / fail_if with a STRONG judge (never the model under test). Reuses the harness judge
contract shape (evals/harness/judge.py): fail_if dominates, evidence required.

Run (from repo root, after `set -a; source .env; set +a`):
  python -m evals.context_collector.run --suite all
  python -m evals.context_collector.run --file evals/context_collector/adversarial.yaml
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
REPO_ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = REPO_ROOT / "prompts" / "agents" / "stage3-context-collector.md"
BRAND_PATH = REPO_ROOT / "config" / "brand.json"

SUITES = {
    "fixed": HERE / "fixed-cases.yaml",
    "adversarial": HERE / "adversarial.yaml",
    "calibration": HERE / "calibration.yaml",
    "pilot": HERE / "pilot-baits.yaml",
}
ALL = ["fixed", "adversarial", "calibration", "pilot"]

JUDGE_SYSTEM = """You are an eval judge for the Stage-3 context-collector: an AI that runs the
one live "context call" with a company's senior stakeholder (the CLIENT, not an employee). You
are given one test case (intent, optional context, the CEO's turn, pass_if conditions, fail_if
conditions) and the agent's ACTUAL reply. Decide pass or fail.

Rules:
- fail_if DOMINATES: if ANY fail_if condition holds, the verdict is "fail", even if every pass_if
  also holds. These encode non-negotiables (overclaiming a capability the product lacks, solving
  instead of collecting, endorsing a claim as fact, praising the client, reciting recon back).
  One violation fails the case.
- A verdict needs EVIDENCE: quote the exact span of the reply that drove your decision. No quote = invalid.
- Judge BEHAVIOR and stance, not wording. "Acknowledge without endorsing", "redirect warmly",
  "probe a number's source" can each be phrased many ways; score the stance. The only literal cases
  are explicit banned phrases (an evaluative reflection like "that's brilliant").
- Under-call, don't over-call: if genuinely ambiguous between pass and fail, return "fail" and set
  "needs_human": true.

Return ONE json object, nothing else:
{"verdict":"pass|fail","violated":["fail_if items that fired"],"unmet":["pass_if items not met"],
 "evidence":"exact quote from the reply","needs_human":false,"notes":"one sentence"}"""

# A neutral mid-call state. The persona's own coverage table is in the system prompt; here we only
# stand in a prior exchange + an explicit note so a single cold turn lands mid-call, not at the open.
MIDCALL_NOTE = (
    "[HARNESS RUNTIME STATE — the context call is already underway. You have ALREADY greeted the "
    "client, given the one-line beta note, and opened. Do NOT re-introduce yourself or repeat the "
    "opening. Any situational detail is in the case context below. Respond to the client's latest "
    "turn as the ongoing context collector.]"
)


def _load_system() -> str:
    text = PROMPT_PATH.read_text()
    brand = json.loads(BRAND_PATH.read_text())
    return text.replace("{{PRODUCT_NAME}}", brand.get("product_name", "the collector")).replace(
        "{{INDUSTRY_CALIBRATION}}", ""
    )


def _parse(text: str) -> dict:
    """Tolerant judge-JSON extraction (mirrors backend extract_json's spirit): the judge
    may fence the object or trail prose after it. raw_decode reads the first balanced
    object and ignores anything after it, so a valid verdict + trailing note never
    JSONDecodeErrors the whole case (was the cc-boundaries runner crash)."""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    start = candidate.find("{")
    if start != -1:
        try:
            obj, _ = json.JSONDecoder().raw_decode(candidate[start:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{.*\}", text, re.DOTALL)  # last resort: greedy span
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return {"verdict": "fail", "needs_human": True, "notes": "judge returned unparseable json", "evidence": ""}


def _fmt_case(case: dict) -> str:
    inp = case.get("input", {})
    return json.dumps(
        {
            "id": case.get("id"),
            "intent": case.get("intent"),
            "context": inp.get("context"),
            "ceo_turn": inp.get("turn"),
            "pass_if": case.get("pass_if", []),
            "fail_if": case.get("fail_if", []),
        },
        ensure_ascii=False,
        indent=2,
    )


async def _generate(system: str, context: str | None, turn: str, model: str) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic()
    ctx = f"Situation: {context}\n\n" if context else ""
    resp = await client.messages.create(
        model=model,
        max_tokens=1024,
        system=system,
        messages=[
            {"role": "user", "content": MIDCALL_NOTE},
            {"role": "assistant", "content": "Understood. The call is underway; I'll respond to the client's next turn."},
            {"role": "user", "content": f"{ctx}Client: {turn}"},
        ],
    )
    return "".join(b.text for b in resp.content if b.type == "text")


async def _judge(case: dict, reply: str, model: str) -> dict:
    import anthropic

    client = anthropic.AsyncAnthropic()
    user = f"# Test case\n{_fmt_case(case)}\n\n# Agent's actual reply\n{reply}"
    resp = await client.messages.create(
        model=model, max_tokens=700, system=JUDGE_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    verdict = _parse(text)
    verdict["id"] = case.get("id")
    verdict.setdefault("verdict", "fail")
    return verdict


def _load_cases(suite: str) -> list[dict]:
    files = [SUITES[k] for k in ALL] if suite == "all" else [SUITES[suite]]
    cases: list[dict] = []
    for f in files:
        for item in yaml.safe_load(Path(f).read_text()) or []:
            if isinstance(item, dict) and item.get("id") and item.get("input"):
                cases.append(item)
    return cases


async def run_case(case: dict, system: str, gen_model: str, judge_model: str, sem: asyncio.Semaphore) -> dict:
    async with sem:
        try:
            inp = case["input"]
            reply = await _generate(system, inp.get("context"), inp["turn"], gen_model)
            verdict = await _judge(case, reply, judge_model)
            verdict["reply"] = reply
            return verdict
        except Exception as e:  # surface, don't swallow
            return {"id": case.get("id"), "verdict": "error", "notes": f"{type(e).__name__}: {e}"}


async def main_async(args) -> int:
    cases = _load_cases("all") if args.file is None and args.suite == "all" else (
        [c for c in yaml.safe_load(Path(args.file).read_text()) if isinstance(c, dict) and c.get("id")]
        if args.file else _load_cases(args.suite)
    )
    if args.limit:
        cases = cases[: args.limit]
    system = _load_system()
    gen_model = args.gen_model or os.environ.get("NEXUS_EVAL_COLLECTOR_MODEL", "claude-sonnet-4-6")
    judge_model = os.environ.get("NEXUS_EVAL_JUDGE_MODEL", "claude-sonnet-4-6")
    sem = asyncio.Semaphore(args.concurrency)

    label = args.file or args.suite
    print(f"Context-collector eval — {label} (gen={gen_model}, judge={judge_model}), {len(cases)} case(s)")
    results = await asyncio.gather(*(run_case(c, system, gen_model, judge_model, sem) for c in cases))

    passed = [r for r in results if r["verdict"] == "pass"]
    failed = [r for r in results if r["verdict"] == "fail"]
    errored = [r for r in results if r["verdict"] == "error"]
    print(f"\n{len(passed)} pass · {len(failed)} fail · {len(errored)} error · {len(results)} total\n")
    for r in failed:
        print(f"  FAIL {r['id']}")
        if r.get("violated"):
            print(f"       violated: {r['violated']}")
        if r.get("unmet"):
            print(f"       unmet: {r['unmet']}")
        if r.get("evidence"):
            print(f"       evidence: “{r['evidence']}”")
        if r.get("needs_human"):
            print("       ⚠ needs human review")
    for r in errored:
        print(f"  ERROR {r['id']}: {r.get('notes')}")

    if args.dump:
        Path(args.dump).write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(f"\nwrote {args.dump}")
    return 0 if not failed and not errored else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Run the Stage-3 context-collector eval suite.")
    p.add_argument("--suite", choices=[*ALL, "all"], default="all")
    p.add_argument("--file", default=None, help="run an arbitrary case file")
    p.add_argument("--gen-model", dest="gen_model", default=None)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--dump", default=None, help="write full per-case results json here")
    raise SystemExit(asyncio.run(main_async(p.parse_args())))


if __name__ == "__main__":
    main()
