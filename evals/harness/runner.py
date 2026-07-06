"""Runner — load interviewer eval cases, drive them through an adapter, judge, report.

Ties evals/interviewer/*.yaml -> InterviewerAdapter -> judge_reply -> pass/fail summary.
Adapter is 'direct' (prompt via Anthropic, runs today) or 'http' (task #7 runtime, URL swap).

  python -m evals.harness --adapter direct --suite all
  python -m evals.harness --adapter http   --suite whatif --base-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import yaml

from .adapters import get_adapter
from .judge import judge_reply

HERE = Path(__file__).resolve().parent
INTERVIEWER_DIR = HERE.parent / "interviewer"
SUITES = {
    "taxonomy": INTERVIEWER_DIR / "failure-taxonomy.yaml",
    "whatif": INTERVIEWER_DIR / "what-if-pairs.yaml",
    "heldout": INTERVIEWER_DIR / "heldout-overfit-check.yaml",
}
# 'all' = the tuning suites only. heldout is a sealed overfit check — opt-in, never bundled.
TUNING_SUITES = ["taxonomy", "whatif"]

# A neutral default handoff. Per-case input.context is injected as a scenario note so
# situational cases (NEVER-list, ~20-min pause) have their setup. Deliberately carries a
# realistic NEVER list + vocabulary so those guards are actually exercised.
DEFAULT_HANDOFF = {
    "goal": "Understand how the respondent's core workflow actually happens, day to day.",
    "known_context": [],
    "topics": [
        {"label": "The main workflow, walked through a specific recent instance", "must_hit": True},
        {"label": "The tools and handoffs involved", "must_hit": True},
        {"label": "What happens when it goes wrong", "must_hit": False},
    ],
    "definition_of_done": ["A specific episode captured with steps, tools, and exceptions."],
    "handling_notes": [],
    "never_list": [
        "Never reveal or imply anything anyone else said.",
        "Never discuss the pending acquisition with anyone on the floor.",
        "Never request or accept credentials or system access.",
    ],
    "vocabulary": ["yıldırım sipariş", "Müşteri Takip"],
    "suggested_questions": [
        "Walk me through the last time you actually did this — what happened first?"
    ],
    "time_budget_min": 30,
}


def load_cases(suite: str) -> list[dict]:
    files = [SUITES[k] for k in TUNING_SUITES] if suite == "all" else [SUITES[suite]]
    cases: list[dict] = []
    for f in files:
        doc = yaml.safe_load(f.read_text())
        for item in doc:
            if isinstance(item, dict) and item.get("id") and item.get("input"):
                cases.append(item)
    return cases


def _handoff_for(case: dict) -> dict:
    h = json.loads(json.dumps(DEFAULT_HANDOFF))  # deep copy
    note = (case.get("input") or {}).get("context")
    if note:
        h["handling_notes"].append(f"Scenario setup: {note}")
    return h


async def run_case(case: dict, adapter, sem: asyncio.Semaphore, judge_model: str | None) -> dict:
    async with sem:
        try:
            token = await adapter.bootstrap(_handoff_for(case))
            reply = await adapter.turn(token, case["input"]["turn"])
            verdict = await judge_reply(case, reply, model=judge_model)
            verdict["reply"] = reply
            return verdict
        except Exception as e:  # a transport/judge error is a case error, surfaced not swallowed
            return {"id": case.get("id"), "verdict": "error", "notes": f"{type(e).__name__}: {e}"}


async def main_async(args) -> int:
    cases = load_cases(args.suite)
    if args.limit:
        cases = cases[: args.limit]
    adapter = get_adapter(args.adapter)
    sem = asyncio.Semaphore(args.concurrency)
    results = await asyncio.gather(*(run_case(c, adapter, sem, args.judge_model) for c in cases))

    passed = [r for r in results if r["verdict"] == "pass"]
    failed = [r for r in results if r["verdict"] == "fail"]
    errored = [r for r in results if r["verdict"] == "error"]

    print(f"\n{'='*68}\nInterviewer eval — {args.suite} via '{args.adapter}' adapter")
    print(f"{len(passed)} pass · {len(failed)} fail · {len(errored)} error · {len(results)} total\n")
    for r in failed:
        print(f"  FAIL {r['id']}")
        if r.get("violated"):
            print(f"       violated: {r['violated']}")
        if r.get("evidence"):
            print(f"       evidence: “{r['evidence']}”")
        if r.get("needs_human"):
            print("       ⚠ needs human review")
    for r in errored:
        print(f"  ERROR {r['id']}: {r.get('notes')}")

    if args.json:
        Path(args.json).write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(f"\nWrote {args.json}")

    # Non-zero exit if anything failed or errored — CI-friendly.
    return 0 if not failed and not errored else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Run the interviewer eval suite.")
    p.add_argument("--adapter", choices=["direct", "http"], default="direct")
    p.add_argument("--suite", choices=["taxonomy", "whatif", "all", "heldout"], default="all")
    p.add_argument("--base-url", dest="base_url", default=None, help="http adapter base URL")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--judge-model", dest="judge_model", default=None)
    p.add_argument("--json", default=None, help="write full results to this path")
    args = p.parse_args()
    if args.base_url:
        import os

        os.environ["NEXUS_APP_BASE_URL"] = args.base_url
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
