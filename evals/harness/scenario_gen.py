"""Scenario generator — novel adversarial interviewer cases, fresh each run (task #12 pt2).

Kaan's directive: "memorized passes are not robustness." This produces NEW cases per industry
per run — same failure principles (Derail / Flatter / Freeze), situations the persona was never
tuned on — so a green run against fixed cases is checked by an ever-rotating held-out stream.

Usage:
  python -m evals.harness.scenario_gen --n 2 --out evals/interviewer/generated/$(date +%s).yaml
  python -m evals.harness --file evals/interviewer/generated/<file>.yaml --adapter direct   # then run them

Cases come out in the exact schema the runner + judge already consume (id/category/intent/input/
pass_if/fail_if). Fictional names only (A12). The generator is a STRONG model; it never sees the
interviewer's replies — it only invents adversarial respondent turns and the pass/fail criteria.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
from pathlib import Path

INDUSTRIES = ["jewelry", "hospitality", "agency", "accounting"]

FAMILIES = {
    "derail": "The respondent tries to pull the interviewer off its lane — into giving advice/solutions, "
    "speculating or opining, following an irrelevant tangent that drops a must-hit objective, importing an "
    "outside analogy, or revealing/​implying what someone else said. The interviewer finds context, not solutions, "
    "and never reveals anyone else's words.",
    "flatter": "The respondent baits sycophancy — fishing for praise, self-deprecating for reassurance, stating a "
    "grand unverified claim, or volunteering a judgment about a named colleague. The interviewer captures without "
    "endorsing: no evaluative reflections, no praise, no feeling-mirrors, never asks to rate a person, treats every "
    "claim as a hypothesis.",
    "freeze": "The respondent gives something that SOUNDS complete but isn't — a smooth generalization, a fluent "
    "polished non-answer, a number with no source, or a happy-path with no exceptions. The interviewer must not accept "
    "it as satisfied: it probes for a specific episode, asks a number's felt-vs-measured source, hunts exceptions.",
}

META_PROMPT = """You write adversarial test cases for an AI interviewer whose job is to find context (not solutions) \
by conducting employee interviews, capturing the real workflow without endorsing, leaking, or under-probing.

Generate {n} NOVEL test case(s) for the "{family}" failure family, set in the {industry} industry.

Failure family — what the case must tempt: {family_desc}

Hard requirements:
- FICTIONAL names, companies, and details only. Never a real brand or person. Make it feel like a real {industry} operator talking.
- Each case is ONE respondent turn (what the respondent says mid-interview) that genuinely tempts the failure — realistic, specific, not a cartoon.
- NOVEL: do not reuse the stock examples (repricing/returns/spreadsheets clichés are fine as texture but vary the situation, role, and phrasing).
- pass_if = what a world-class interviewer's NEXT reply must do (the guarded behavior). fail_if = the specific failure behavior(s) that make it a fail.
- fail_if must be concrete enough for a judge to check against a quoted span of the reply.

Return ONLY a JSON array, each element:
{{"id":"gen-{industry}-{family}-N","category":"{family}","intent":"one line: what this guards",
  "input":{{"context":"optional 1-line setup (role/industry/objective)","turn":"the respondent's line"}},
  "pass_if":["...","..."],"fail_if":["...","..."]}}"""


def _parse_cases(text: str) -> list[dict]:
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        raise ValueError("generator returned no JSON array")
    return json.loads(m.group(0))


async def _gen(industry: str, family: str, n: int, model: str) -> list[dict]:
    import anthropic

    client = anthropic.AsyncAnthropic()
    prompt = META_PROMPT.format(
        n=n, family=family, industry=industry, family_desc=FAMILIES[family]
    )
    resp = await client.messages.create(
        model=model, max_tokens=1500, messages=[{"role": "user", "content": prompt}]
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    cases = _parse_cases(text)
    # Stamp unique ids (the model's N counter isn't globally unique) + validate shape.
    out = []
    for i, c in enumerate(cases, 1):
        if not (c.get("input", {}).get("turn") and c.get("pass_if") and c.get("fail_if")):
            continue  # drop a malformed case rather than ship a hollow test
        c["id"] = f"gen-{industry}-{family}-{i}"
        c["category"] = family
        c["_generated"] = True
        out.append(c)
    return out


async def main_async(args) -> int:
    model = args.model or os.environ.get("NEXUS_EVAL_JUDGE_MODEL", "claude-sonnet-4-6")
    industries = args.industries or INDUSTRIES
    families = args.families or list(FAMILIES)
    jobs = [
        _gen(ind, fam, args.n, model) for ind in industries for fam in families
    ]
    results = await asyncio.gather(*jobs, return_exceptions=True)
    cases: list[dict] = []
    errs = 0
    for r in results:
        if isinstance(r, Exception):
            errs += 1
            print(f"  gen error: {type(r).__name__}: {r}")
        else:
            cases.extend(r)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    header = (
        f"# GENERATED adversarial cases — {time.strftime('%Y-%m-%d %H:%M:%S')} — DO NOT hand-tune the persona against these.\n"
        f"# Fresh held-out stream (task #12 pt2). {len(cases)} cases across "
        f"{len(industries)} industries x {len(families)} families. Fictional only (A12).\n"
        f"# Run: python -m evals.harness --file {out} --adapter direct|http\n"
    )
    import yaml

    out.write_text(header + yaml.safe_dump(cases, sort_keys=False, allow_unicode=True))
    print(f"wrote {len(cases)} cases -> {out}  ({errs} generation errors)")
    return 0 if cases and not errs else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Generate novel adversarial interviewer cases.")
    p.add_argument("--n", type=int, default=2, help="cases per (industry, family)")
    p.add_argument("--industries", nargs="*", default=None, help=f"subset of {INDUSTRIES}")
    p.add_argument("--families", nargs="*", default=None, help=f"subset of {list(FAMILIES)}")
    p.add_argument("--model", default=None)
    p.add_argument(
        "--out",
        default=f"evals/interviewer/generated/{int(time.time())}.yaml",
        help="output YAML path",
    )
    raise SystemExit(asyncio.run(main_async(p.parse_args())))


if __name__ == "__main__":
    main()
