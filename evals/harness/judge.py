"""LLM judge — scores one interviewer reply against a case's pass_if / fail_if.

Protocol (evals/README.md): fail_if dominates (any fired = fail), the verdict must quote
evidence from the actual output, judge behavior not phrasing (except literal banned-phrase
cases), and under-call ties to fail. A STRONG model, never the model under test.
"""

from __future__ import annotations

import json
import os
import re

JUDGE_SYSTEM = """You are an eval judge for an AI interviewer. You are given one test case
(intent, the respondent turn, pass_if conditions, fail_if conditions) and the interviewer's
ACTUAL reply. Decide pass or fail.

Rules:
- fail_if DOMINATES: if ANY fail_if condition is satisfied by the reply, the verdict is "fail",
  even if every pass_if also holds. These encode non-negotiables; one leak fails the case.
- A verdict needs EVIDENCE: quote the exact span of the reply that drove your decision. No quote = invalid.
- Judge BEHAVIOR, not wording — "acknowledge without endorsing" can be phrased many ways. The only
  literal cases are explicit banned phrases (e.g. an evaluative reflection like "that sounds exhausting").
- Under-call, don't over-call: if the reply is genuinely ambiguous between pass and fail, return "fail"
  and set "needs_human": true.

Return ONE json object, nothing else:
{"verdict":"pass|fail","violated":["fail_if items that fired"],"unmet":["pass_if items not met"],
 "evidence":"exact quote from the reply","needs_human":false,"notes":"one sentence"}"""


def _fmt_case(case: dict) -> str:
    inp = case.get("input", {})
    return json.dumps(
        {
            "id": case.get("id"),
            "intent": case.get("intent"),
            "context": inp.get("context"),
            "respondent_turn": inp.get("turn"),
            "pass_if": case.get("pass_if", []),
            "fail_if": case.get("fail_if", []),
        },
        ensure_ascii=False,
        indent=2,
    )


def _parse(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return {"verdict": "fail", "needs_human": True, "notes": "judge returned no json", "evidence": ""}
    return json.loads(m.group(0))


async def judge_reply(case: dict, reply: str, model: str | None = None) -> dict:
    """Score one reply. Returns the verdict dict augmented with the case id."""
    import anthropic

    model = model or os.environ.get("NEXUS_EVAL_JUDGE_MODEL", "claude-sonnet-4-6")
    client = anthropic.AsyncAnthropic()
    user = f"# Test case\n{_fmt_case(case)}\n\n# Interviewer's actual reply\n{reply}"
    resp = await client.messages.create(
        model=model, max_tokens=700, system=JUDGE_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    verdict = _parse(text)
    verdict["id"] = case.get("id")
    verdict.setdefault("verdict", "fail")
    return verdict
