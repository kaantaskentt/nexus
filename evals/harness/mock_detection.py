"""Mock-detection — the anti-theater guarantee (task #12 addition, Kaan/team-lead).

Kaan caught the interview chat serving CANNED replies. This check proves the turn engine is doing
FRESH generation, not replaying a script: it opens two independent fresh sessions, sends each the
SAME respondent turn, and asserts the two interviewer replies are NOT byte-identical (two real LLM
generations differ; a canned/mock reply is identical every time). It also fails loudly if any reply
equals a known fixture/placeholder string.

Runs automatically as an http-suite preflight (runner calls it) and standalone:
  python -m evals.harness.mock_detection --base-url http://localhost:8000
Exit code is non-zero on failure — a demo interviewer that serves scripted replies must fail the gate.
"""

from __future__ import annotations

import argparse
import asyncio
import os

from .adapters import HttpInterviewerAdapter

# Strings that must NEVER be a live reply — obvious placeholders / known canned mock text.
# Add any real canned string here the moment it's discovered (standing loop).
KNOWN_CANNED = [
    "[mock reply]",
    "This is a mock response.",
    "Mock interview response",
    "Lorem ipsum",
    "TODO",
    "placeholder",
]

# A neutral, generative respondent turn — same for both sessions. Different enough from the scripted
# opening that two fresh generations should diverge in wording.
PROBE_TURN = "Sure, happy to help. Where would you like me to start?"

# Minimum plausible length for a real interviewer reply (a canned stub is usually short/empty).
MIN_REPLY_LEN = 40

DEFAULT_HANDOFF = {
    "goal": "Understand the respondent's core workflow.",
    "topics": [{"label": "The main workflow", "must_hit": True}],
    "never_list": ["Never reveal anything anyone else said."],
    "vocabulary": [],
    "time_budget_min": 30,
}


async def run_check(base_url: str | None = None) -> dict:
    adapter = HttpInterviewerAdapter(base_url)
    # Two independent fresh sessions (each bootstrap warms up its own opening turn).
    t1, t2 = await asyncio.gather(
        adapter.bootstrap(dict(DEFAULT_HANDOFF)), adapter.bootstrap(dict(DEFAULT_HANDOFF))
    )
    r1, r2 = await asyncio.gather(adapter.turn(t1, PROBE_TURN), adapter.turn(t2, PROBE_TURN))

    problems: list[str] = []
    if r1.strip() == r2.strip():
        problems.append(
            "CANNED: two fresh sessions returned BYTE-IDENTICAL replies to the same turn — "
            "the engine is replaying a script, not generating."
        )
    for r, tag in ((r1, "session-1"), (r2, "session-2")):
        if len(r.strip()) < MIN_REPLY_LEN:
            problems.append(f"STUB: {tag} reply is implausibly short ({len(r.strip())} chars): {r!r}")
        low = r.lower()
        for canned in KNOWN_CANNED:
            if canned.lower() in low:
                problems.append(f"FIXTURE-STRING: {tag} reply contains known canned text {canned!r}")

    return {
        "passed": not problems,
        "problems": problems,
        "reply_1": r1,
        "reply_2": r2,
        "identical": r1.strip() == r2.strip(),
    }


async def main_async(base_url: str | None) -> int:
    try:
        res = await run_check(base_url)
    except Exception as e:  # a transport error is a check error, surfaced not swallowed
        print(f"mock-detection ERROR: {type(e).__name__}: {e}")
        return 2
    print("=" * 68)
    print("Mock-detection (anti-theater): " + ("PASS — fresh generation" if res["passed"] else "FAIL"))
    if not res["passed"]:
        for p in res["problems"]:
            print(f"  ✗ {p}")
        print(f"  reply_1: {res['reply_1'][:160]!r}")
        print(f"  reply_2: {res['reply_2'][:160]!r}")
    return 0 if res["passed"] else 1


def main() -> None:
    p = argparse.ArgumentParser(description="Assert the interview engine generates fresh, non-canned replies.")
    p.add_argument("--base-url", dest="base_url", default=None)
    args = p.parse_args()
    if args.base_url:
        os.environ["NEXUS_APP_BASE_URL"] = args.base_url
    raise SystemExit(asyncio.run(main_async(args.base_url)))


if __name__ == "__main__":
    main()
