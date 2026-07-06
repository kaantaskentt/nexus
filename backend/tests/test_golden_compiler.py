"""Golden regression — the EK-prescribed A/B pattern, automated.

Compiles the fictional Auria jewellery transcript with the REAL model and checks
the load-bearing invariants from evals/compiler/golden-jewelry-expected-records.yaml
(the `assertions` block). This calls the live API and is non-deterministic in exact
wording, so it is OPT-IN: set NEXUS_RUN_GOLDEN=1 to run. The fast suite (test_compiler,
test_immutability) stays offline and deterministic and remains the default gate.

Run:  NEXUS_RUN_GOLDEN=1 python -m pytest tests/test_golden_compiler.py -s
"""

import os
import re

import pytest

from app.config import REPO_ROOT, get_settings
from app.pipeline import compiler, entities
from tests.conftest import make_session, make_workspace

pytestmark = pytest.mark.skipif(
    os.environ.get("NEXUS_RUN_GOLDEN") != "1" or not get_settings().anthropic_api_key,
    reason="golden compile hits the live model — set NEXUS_RUN_GOLDEN=1 to run",
)

TRANSCRIPT = REPO_ROOT / "evals" / "compiler" / "golden-jewelry-transcript.md"
_TURN = re.compile(r"^([A-Za-zÇĞİÖŞÜçğıöşü]+)\s*\((\d{2}:\d{2})\):\s*(.+)$")


def _parse_turns() -> list[tuple[str, str]]:
    turns = []
    for line in TRANSCRIPT.read_text().splitlines():
        m = _TURN.match(line.strip())
        if not m:
            continue
        speaker, _ts, text = m.groups()
        role = "agent" if speaker == "N" else "respondent"
        turns.append((role, text))
    return turns


def _has(rows, needles, **preds) -> bool:
    """A record whose claim_text or evidence_quote contains any needle, matching preds."""
    needles = [needles] if isinstance(needles, str) else needles
    for r in rows:
        blob = f"{r['claim_text']} {r['evidence_quote'] or ''}".lower()
        if not any(n.lower() in blob for n in needles):
            continue
        if all(r[k] == v for k, v in preds.items()):
            return True
    return False


async def test_golden_jewelry_extraction(db):
    ws = await make_workspace(db, industry="jewelry")
    derya, _ = await entities.resolve_or_create(ws, "Derya", role="Founder")
    sess = await make_session(db, ws, interviewee_id=derya)

    # Seed the Stage-1 SCRAPED context the fixture assumes: the website says 12
    # boutiques. The call correction (nine) must supersede THIS record.
    src = await db.fetchval(
        "insert into scrape_sources (workspace_id, kind, content) "
        "values ($1, 'website', '{}'::jsonb) returning id", ws)
    await db.execute(
        "insert into claim_records (workspace_id, scrape_source_id, kind, topic, tag, claim_text) "
        "values ($1, $2, 'statement', 'company_fact', 'SCRAPED', "
        "'Auria Jewellery operates 12 boutiques')", ws, src)

    for i, (role, text) in enumerate(_parse_turns()):
        await db.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,$3,$4)",
            sess, i, role, text,
        )

    await compiler.compile_session({"session_id": str(sess)})

    rows = [dict(r) for r in await db.fetch(
        "select * from claim_records where workspace_id=$1 and session_id=$2", ws, sess)]
    ents = {e["canonical_name"].lower() for e in await db.fetch(
        "select canonical_name from entities where workspace_id=$1", ws)}

    # HARD = product non-negotiables; a regression here ships a broken product.
    # SOFT = tag-judgment quality that varies with model sampling — reported, not gating.
    hard_fails, soft_fails = [], []

    def hard(name, ok):
        if not ok:
            hard_fails.append(name)

    def soft(name, ok):
        if not ok:
            soft_fails.append(name)

    # Filler never becomes a record.
    hard("filler-discarded", not _has(rows, ["ready to begin", "hear me alright"]))

    # The canonical retraction: exactly one time correction (returns 40→10); it
    # supersedes; the original 40 survives; nothing is averaged to 25.
    returns_corr = [r for r in rows if r["kind"] == "correction" and r["topic"] == "time_or_cost"]
    hard("returns-correction-exists", bool(returns_corr))
    hard("returns-correction-supersedes", any(r["supersedes_id"] for r in returns_corr))
    hard("returns-original-survives", _has(rows, ["forty", "40 min"]))
    hard("returns-not-averaged", not _has(rows, ["twenty-five", "25 min", "twenty five"]))

    # Boutique correction supersedes the seeded SCRAPED record; scraped row survives.
    boutique_corr = [r for r in rows if r["kind"] == "correction" and r["topic"] == "company_fact"]
    hard("boutique-correction-exists", bool(boutique_corr))
    hard("boutique-correction-supersedes", any(r["supersedes_id"] for r in boutique_corr))
    hard("scraped-record-survives", bool(await db.fetchval(
        "select 1 from claim_records where tag='SCRAPED' and workspace_id=$1", ws)))

    # Metin: fact + judgment split; ONLY the judgment quarantined (one leak kills it).
    metin = [r for r in rows if "metin" in f"{r['claim_text']} {r['evidence_quote'] or ''}".lower()]
    hard("metin-two-records", len(metin) >= 2)
    hard("metin-judgment-quarantined", any(r["quarantined"] and "disorgan" in
         f"{r['claim_text']} {r['evidence_quote'] or ''}".lower() for r in metin))
    hard("metin-fact-not-quarantined", any(not r["quarantined"] for r in metin))

    # Vocabulary verbatim, untranslated.
    hard("vocab-yildirim", _has(rows, ["yıldırım"]))
    hard("vocab-musteri-takip", _has(rows, ["müşteri takip"]))

    # Directive stored with no trust tag (feeds the NEVER list, never client-facing).
    hard("directive-null-tag", any(r["kind"] == "directive" and r["tag"] is None for r in rows))

    # Client-facing style (task #19): the compiler's AUTHORED claim_text renders straight
    # to Snapshot/Insights/Knowledge Base and must carry NO em-dash (an AI tell). The
    # verbatim evidence_quote is exempt — the speaker's own dashes are data (rule 3). We
    # exclude the seeded SCRAPED row (not model output) to test only what the compiler wrote.
    em_dash_claims = [
        r["claim_text"] for r in rows if r["tag"] != "SCRAPED" and "—" in (r["claim_text"] or "")
    ]
    hard("no-em-dash-in-claim_text", not em_dash_claims)

    # NEW-PERSON entities minted (client-side).
    for name in ["selin", "kerem", "metin"]:
        hard(f"entity-{name}", any(name in e for e in ents))
    hard("entity-pinar", any("nar" in e for e in ents))  # Pınar / Pinar

    # SOFT — tag calls that depend on judgment sampling.
    soft("craftspeople-guess", _has(rows, ["craftspeople", "twelve craft"], tag="GUESS"))
    soft("repricing-time-guess", _has(rows, ["two hours", "repric"], tag="GUESS"))
    soft("pinar-tenure-guess", _has(rows, ["eight months", "months ago"], tag="GUESS"))
    soft("pain-episode-confirmed",
         _has(rows, ["bridal", "two days", "sitting finished"], topic="pain", tag="CONFIRMED"))

    print(f"\n=== golden extraction: {len(rows)} call records, {len(ents)} entities ===")
    print(f"HARD: {'PASS' if not hard_fails else 'FAIL ' + str(hard_fails)}")
    print(f"SOFT tag-quality (not gating): "
          f"{4 - len(soft_fails)}/4 passed" + (f", missed {soft_fails}" if soft_fails else ""))
    assert not hard_fails, f"golden non-negotiables failed: {hard_fails}"
