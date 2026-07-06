"""Single-prompt eval runner for the SPEC-ONLY plan suites (task #26).

The interviewer adapters drive a multi-turn turn engine; the plan-generator and nexus-check
reviewer are single-shot prompts over records/context, so they never had a runner and their
evals (evals/plan/*.yaml) sat SPEC-ONLY. This is that runner: for each case it feeds the case
`input.context` + `input.turn` to the TARGET prompt (loaded from disk, brand/industry markers
resolved the way the backend's load_prompt does) and scores the output against pass_if/fail_if
with a strong LLM judge (fail_if dominates, evidence required) reusing the harness judge shape.

No backend/DB: it targets the prompt files directly, like DirectPromptAdapter. A STRONG judge,
never the model under test.

Run:
  python -m evals.harness.plan_runner --file evals/plan/hidden-lever-objectives.yaml
  python -m evals.harness.plan_runner --file evals/plan/leading-question-catch.yaml
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import yaml

from .judge import _fmt_case, _parse

REPO_ROOT = Path(__file__).resolve().parents[2]
BRAND_PATH = REPO_ROOT / "config" / "brand.json"

# The single-prompt targets this runner knows how to drive (evals/plan/*.yaml `target`).
PROMPT_FILES = {
    "plan-generator": "prompts/agents/plan-generator.md",
    "nexus-check-reviewer": "prompts/agents/nexus-check-reviewer.md",
}

PLAN_JUDGE_SYSTEM = """You are an eval judge for an AI planning/reviewing agent (an interview
plan generator or a plan reviewer). You are given one test case (intent, the context, the input
turn, pass_if conditions, fail_if conditions) and the agent's ACTUAL output. Decide pass or fail.

Rules:
- fail_if DOMINATES: if ANY fail_if condition holds, the verdict is "fail", even if every pass_if
  also holds. These encode non-negotiables (leaking a name/quote, inventing an unsupported objective,
  a person-judgment framing) — one violation fails the case.
- A verdict needs EVIDENCE: quote the exact span of the output that drove your decision. No quote = invalid.
- Judge BEHAVIOR and substance, not wording. An objective can be phrased many ways; credit it if the
  meaning is present. For a CONTROL case (fail_if = "invents an unsupported objective"), pass only if the
  output stays tied to what the context actually supports.
- Under-call, don't over-call: if genuinely ambiguous, return "fail" and set "needs_human": true.

Return ONE json object, nothing else:
{"verdict":"pass|fail","violated":["fail_if items that fired"],"unmet":["pass_if items not met"],
 "evidence":"exact quote from the output","needs_human":false,"notes":"one sentence"}"""


def _load_prompt(target: str) -> str:
    rel = PROMPT_FILES.get(target)
    if rel is None:
        raise ValueError(f"plan_runner has no prompt mapping for target {target!r}")
    text = (REPO_ROOT / rel).read_text()
    brand = json.loads(BRAND_PATH.read_text())
    return text.replace("{{PRODUCT_NAME}}", brand.get("product_name", "the agent")).replace(
        "{{INDUSTRY_CALIBRATION}}", ""
    )


async def _generate(target: str, context: str, turn: str, model: str) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic()
    user = f"{context}\n\n{turn}".strip()
    resp = await client.messages.create(
        model=model, max_tokens=2048, system=_load_prompt(target),
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in resp.content if b.type == "text")


async def _judge(case: dict, output: str, model: str) -> dict:
    import anthropic

    client = anthropic.AsyncAnthropic()
    user = f"# Test case\n{_fmt_case(case)}\n\n# Agent's actual output\n{output}"
    resp = await client.messages.create(
        model=model, max_tokens=700, system=PLAN_JUDGE_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    verdict = _parse(text)
    verdict["id"] = case.get("id")
    verdict.setdefault("verdict", "fail")
    return verdict


async def run_case(case: dict, gen_model: str, judge_model: str) -> dict:
    inp = case.get("input", {})
    output = await _generate(case["target"], inp.get("context", ""), inp.get("turn", ""), gen_model)
    verdict = await _judge(case, output, judge_model)
    verdict["_output"] = output
    return verdict


async def main_async(args) -> int:
    cases = [c for c in yaml.safe_load(Path(args.file).read_text()) if c.get("target") in PROMPT_FILES]
    gen_model = args.gen_model or os.environ.get("NEXUS_EVAL_PLAN_MODEL", "claude-sonnet-4-6")
    judge_model = os.environ.get("NEXUS_EVAL_JUDGE_MODEL", "claude-sonnet-4-6")
    print(f"Plan runner: {len(cases)} case(s) from {Path(args.file).name} (gen={gen_model})")

    verdicts = await asyncio.gather(*(run_case(c, gen_model, judge_model) for c in cases))
    passed = sum(1 for v in verdicts if v.get("verdict") == "pass")
    for v in verdicts:
        mark = "PASS" if v.get("verdict") == "pass" else "FAIL"
        extra = "" if v.get("verdict") == "pass" else f"  violated={v.get('violated')} unmet={v.get('unmet')}"
        print(f"  [{mark}] {v['id']}: {v.get('notes','')[:90]}{extra}")
    print(f"\n{passed}/{len(cases)} passed")
    if args.dump:
        Path(args.dump).write_text(json.dumps([{k: v[k] for k in v if k != '_output'} | {'output': v.get('_output','')} for v in verdicts], ensure_ascii=False, indent=2))
        print(f"wrote {args.dump}")
    return 0 if passed == len(cases) else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Run a SPEC-ONLY plan/review eval suite through its single-prompt target.")
    p.add_argument("--file", required=True, help="path to a plan eval yaml (judge-compatible cases)")
    p.add_argument("--gen-model", dest="gen_model", default=None)
    p.add_argument("--dump", default=None, help="optional path to write per-case output + verdict json")
    raise SystemExit(asyncio.run(main_async(p.parse_args())))


if __name__ == "__main__":
    main()
