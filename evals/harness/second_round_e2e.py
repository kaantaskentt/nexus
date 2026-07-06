"""Round-2 second-round E2E driver: send an APPROVED plan -> drive the interview against the REAL
turn engine -> complete -> compile -> fetch the report (workflow, findings, PERCEPTION GAPS).

Standing-loop infrastructure: respondent_sim exercises the synchronous turn engine only; this driver
adds the send + complete + compile + report legs, so a round-2 interview compiles into the SAME
workspace as round 1 and the perception-gap comparator can fire (a ceo_vs_floor gap in live data).
Needs an EVAL_MODE server + worker running (the full fan-out is async post-compile).

    python -m evals.harness.second_round_e2e --plan-id <uuid> --persona burak-repricing \
        --base-url http://localhost:8000 --turns 12

The persona is a respondent-sim stem in prompts/personas/respondents/. Report is polled until the
async fan-out populates (workflow non-empty) or --wait seconds elapse.
"""
import argparse, asyncio, json, os, sys
import httpx

from .respondent_sim import RespondentSim, load_persona
from .adapters import HttpInterviewerAdapter, TURN_PATH


async def run(plan_id: str, persona: str, base_url: str, turns: int, wait: int) -> dict:
    sim_prompt, _ = load_persona(persona)
    sim = RespondentSim(sim_prompt)
    interviewer = HttpInterviewerAdapter(base_url)

    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{base_url}/api/plans/{plan_id}/send", json={"modality": "text", "language": "en"})
        r.raise_for_status()
        token = r.json().get("invite_token") or r.json().get("token")
    print(f"sent plan {plan_id[:8]} -> token {token[:8]}…")

    await interviewer._post(TURN_PATH.format(token=token), {"message": None})  # warm/open
    transcript = [{"speaker": "interviewer", "text": await interviewer.turn(token, "(joins the call, ready to begin)")}]
    for i in range(turns):
        rl = await sim.reply(transcript)
        transcript.append({"speaker": "respondent", "text": rl})
        transcript.append({"speaker": "interviewer", "text": await interviewer.turn(token, rl)})
    print(f"drove {turns} turns")

    async with httpx.AsyncClient(timeout=60) as c:
        await c.post(f"{base_url}/api/sessions/by-token/{token}/complete")
        print("completed -> compile queued; polling report for the async fan-out…")
        deadline = asyncio.get_event_loop().time() + wait
        last = {}
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(6)
            j = (await c.get(f"{base_url}/api/reports/by-plan/{plan_id}")).json()
            if "error" in j:
                continue
            last = j
            wf = j.get("workflow")
            steps = len((wf or {}).get("steps", []) if isinstance(wf, dict) else (wf or []))
            if steps or j.get("interview_quality"):   # fan-out has populated
                break
    return {"transcript": transcript, "report": last}


def _summary(report: dict) -> None:
    wf = report.get("workflow")
    steps = len((wf or {}).get("steps", []) if isinstance(wf, dict) else (wf or []))
    gaps = report.get("perception_gaps") or []
    print("\n=== REPORT ===")
    print(f"key_findings: {len(report.get('key_findings') or [])}  workflow_steps: {steps}  "
          f"conflicts: {len(report.get('conflict_points') or [])}  perception_gaps: {len(gaps)}")
    if gaps:
        print("PERCEPTION GAPS:", json.dumps(gaps, ensure_ascii=False, indent=2)[:1500])
    else:
        print("(no perception gap surfaced — check the async fan-out ran, and whether a comparable "
              "CLAIMED baseline exists; a quarantined person-judgment won't compare, see F41 proposal)")


def main() -> None:
    p = argparse.ArgumentParser(description="Round-2 second-round E2E driver (send->interview->compile->report).")
    p.add_argument("--plan-id", required=True)
    p.add_argument("--persona", required=True, help="respondent-sim stem in prompts/personas/respondents/")
    p.add_argument("--base-url", default=os.environ.get("NEXUS_APP_BASE_URL", "http://localhost:8000"))
    p.add_argument("--turns", type=int, default=12)
    p.add_argument("--wait", type=int, default=180, help="seconds to poll for the async fan-out")
    p.add_argument("--json", default=None)
    args = p.parse_args()
    out = asyncio.run(run(args.plan_id, args.persona, args.base_url, args.turns, args.wait))
    _summary(out["report"])
    if args.json:
        open(args.json, "w").write(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
