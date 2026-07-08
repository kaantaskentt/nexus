"""Simulations surface backend (task #28).

One read-only endpoint: the proving history (cast + judged rounds) the Simulations page
renders above a workspace's own eval runs. Data lives in app/simulation_history.py —
versioned with the code, sourced only from judged matrix runs (evals/e2e/proof-matrix.md).
Admin-gated by the blanket dependency in main.py. There is deliberately NO run endpoint:
launching simulations from the app is PROPOSED, not approved (park note July 8) — runs
are driven by the eval harness."""

from fastapi import APIRouter

from ..simulation_history import SIMULATION_CAST, SIMULATION_ROUNDS

router = APIRouter()


@router.get("/history")
async def simulation_history():
    return {"cast": SIMULATION_CAST, "rounds": SIMULATION_ROUNDS}
