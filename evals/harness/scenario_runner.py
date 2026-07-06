"""Scripted multi-turn scenario runner over the REAL turn engine (http adapter).

Single-turn cases judge the NEXT reply; some biases only appear across turns (F42 halo: a proud
step must sit in context BEFORE the adjacent claim rides its glow). This runner bootstraps ONE
stateful session, replays a FIXED sequence of respondent turns against it (fixed, not an LLM
sim, so the isolation is reproducible), and judges the interviewer's reply after a designated
turn with the standard interviewer judge.

Built for #32 (F42 halo). The scenario schema matches evals/interviewer/long-interview-drift.yaml,
so that suite can run here too (add end-state judging when it's needed).

Run (needs the EVAL_MODE server):
  python -m evals.harness.scenario_runner --file evals/interviewer/f42-halo-scenario.yaml --base-url http://localhost:8001
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

import yaml

from .adapters import HttpInterviewerAdapter
from .judge import judge_reply


async def run_scenario(sc: dict, base_url: str | None, judge_model: str | None = None) -> dict:
    adapter = HttpInterviewerAdapter(base_url)
    token = await adapter.bootstrap(sc["handoff"])

    transcript: list[dict] = []
    opening = await adapter.turn(token, "(joins the call, ready to begin)")
    transcript.append({"speaker": "interviewer", "text": opening})

    after = sc["judge"]["after_turn"]
    judged_reply = None
    for i, line in enumerate(sc["turns"], start=1):
        line = " ".join(str(line).split())  # collapse YAML folded whitespace
        transcript.append({"speaker": "respondent", "text": line})
        reply = await adapter.turn(token, line)
        transcript.append({"speaker": "interviewer", "text": reply})
        if i == after:
            judged_reply = reply
    if judged_reply is None:
        raise ValueError(f"judge.after_turn={after} is out of range for {len(sc['turns'])} turns")

    case = {
        "id": sc["id"],
        "intent": sc["judge"].get("intent") or sc.get("intent"),
        "input": {"context": sc.get("intent"), "turn": " ".join(str(sc["turns"][after - 1]).split())},
        "pass_if": sc["judge"].get("pass_if", []),
        "fail_if": sc["judge"].get("fail_if", []),
    }
    verdict = await judge_reply(case, judged_reply, model=judge_model)
    verdict["_reply"] = judged_reply
    verdict["_transcript"] = transcript
    return verdict


async def main_async(args) -> int:
    doc = yaml.safe_load(Path(args.file).read_text())
    sc = doc["scenario"] if "scenario" in doc else doc
    print(f"Scenario: {sc['id']} — judging interviewer reply after respondent turn {sc['judge']['after_turn']}")
    v = await run_scenario(sc, args.base_url)
    mark = "PASS" if v.get("verdict") == "pass" else "FAIL"
    print(f"\n[{mark}] {sc['id']}")
    print(f"  violated: {v.get('violated')}")
    print(f"  evidence: {v.get('evidence','')[:160]}")
    print(f"  notes:    {v.get('notes','')[:160]}")
    print(f"\n  judged interviewer reply:\n  {v['_reply'][:500]}")
    if args.dump:
        Path(args.dump).write_text(json.dumps({k: v[k] for k in v if not k.startswith('_')} |
                                              {"reply": v["_reply"], "transcript": v["_transcript"]},
                                              ensure_ascii=False, indent=2))
        print(f"\nwrote {args.dump}")
    return 0 if v.get("verdict") == "pass" else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Replay a scripted multi-turn scenario against the real turn engine.")
    p.add_argument("--file", required=True)
    p.add_argument("--base-url", dest="base_url", default=None)
    p.add_argument("--dump", default=None)
    args = p.parse_args()
    if args.base_url:
        os.environ["NEXUS_APP_BASE_URL"] = args.base_url
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
