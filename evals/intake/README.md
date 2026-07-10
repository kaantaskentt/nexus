# Intake-agent eval suite (SIMPLIFY ADDENDUM 4)

Judges `prompts/agents/intake-interviewer.md` on the safety spine ADDENDUM 4 requires:
**asks-not-tells** (a person-judgment never becomes a question) and a **storage decision that is
honest** (a durable neutral company fact → `store_context`; an opinion about a named person →
`plan_only`, quarantined, never in a question; vague input → `plan_only`, nothing invented).
One question at a time.

The endpoint's OWN quarantine is enforced at the data layer (a stored fact is compiled through the
standard CLAIMED path, so the compiler's sentiment quarantine is the backstop — see
`backend/tests/test_intake.py`). These evals check the AGENT's behavior upstream of that: it should
not route a person-opinion to storage or a question in the first place.

Run (from repo root, after `set -a; source .env; set +a`):

    python -m evals.intake.run --suite fixed

The runner loads the prompt directly (brand + industry resolved like the backend), so it does not
need migration 0025 applied. STRONG judge; `fail_if` dominates. Cases are the spine — do not weaken
them; if a case miscalibrates, fix the case for the right reason, never relax the safety bar.
