<!-- Respondent-simulator personas (task #16) — the synthetic interviewees for the agent-vs-agent E2E. -->

# Respondent-simulator personas

Five reusable synthetic SMB employees that the REAL interviewer (turn engine) interviews, so we can prove the
interviewer works before pointing it at a real person. Each is a runnable **system prompt** for the respondent
side — not a description — driven by `evals/harness/respondent_sim.py`. All fictional (A12).

| File | Role / company | Speaking style | The test |
|---|---|---|---|
| `jewelry-ops-manager.md` | Lale Aksu, Serein Fine Jewelry | proud maker | polished-first; real detail only under episode-anchoring |
| `hotel-frontdesk-lead.md` | Marco Ferri, Hotel Ambra | rambler / tangent-prone | must be steered back to specifics |
| `agency-account-manager.md` | Priya Nair, Bramble & Co | polished / hedger | must cut through the on-message version |
| `bookkeeper.md` | Tomás Reyes, Halden & Vance | terse / hedger | brevity ≠ completeness; must keep probing |
| `warehouse-foreman.md` | Bekir Yıldız, Kestrel Logistics | skeptical / terse / non-native EN | must earn trust before he opens up |

## What each persona carries
- **A real workflow** (concrete steps, shadow tools, vocabulary) — the ground truth.
- **A speaking style** from the set rambler/terse/anxious/proud/hedger/tangent-prone/non-native.
- **Hidden knowledge (H1–H3)** the respondent does NOT volunteer — it only surfaces under episode-anchoring or
  exception-hunting. This asymmetry is the whole measurement: a lazy interviewer gets the brochure; a good one
  gets the real process.
- **1–2 planted traps** from the failure taxonomy (bait to solution / agree / praise / accept polish / lose the
  skeptic). A `<!-- SCORER-ONLY -->` block at the bottom lists the hidden items + traps for the judge; it's
  stripped from what the simulator sees so it can't leak.

## Run it (agent-vs-agent)

```
python -m evals.harness.respondent_sim --persona jewelry-ops-manager --base-url http://localhost:8000 --turns 14
```
Drives interviewer(real engine) ↔ respondent(sim) for N turns, then a judge scores:
1. **hidden-knowledge extraction** — did H1/H2/H3 surface?
2. **trap resistance** — did the interviewer avoid the baits?
3. **Stage 2 tie-in** — each pre-generated heuristic in `evals/e2e/stage2-heuristics.yaml` scored
   confirmed/busted/partial from what surfaced (credited only when raised unprompted, F13) — the learning loop
   validated offline exactly as it runs with a real client.

Exit code is 0 on a clean run (most hidden knowledge surfaced, no traps taken). This is the engine of the
full E2E (task #15), run across all five personas until clean twice.
