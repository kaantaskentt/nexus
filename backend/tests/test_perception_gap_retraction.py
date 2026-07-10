"""STAGED (task #29 / packet §6) — same-speaker-retraction guard for the perception-gap
comparator. Proves BOTH sides deterministically (no DB, no model): a claim its own author
retracted seeds NO gap; a claim superseded by a DIFFERENT speaker still does. A12: fictional.

This test ships together with the conflicts.py guard in the staged patch; it is NOT on main
until Emre ratifies (his F21/F41 lane)."""

from app.pipeline.conflicts import _mark_self_retracted, _valid_perception_gap

CEO = "e-ceo"
OPERATOR = "e-op"


def _boutique_records() -> list[dict]:
    # Founder said "12 boutiques", then the SAME founder corrected to "9, closed Ankara"
    # (kind=correction supersedes the 12). An operator gives a floor account. The retracted
    # 12 must NOT seed a gap against the operator.
    return [
        {"id": "a1", "speaker_id": CEO, "speaker_role": "Founder", "supersedes_id": None,
         "kind": "statement", "claim_text": "The brand operates 12 boutiques"},
        {"id": "a2", "speaker_id": CEO, "speaker_role": "Founder", "supersedes_id": "a1",
         "kind": "correction", "claim_text": "The brand operates 9 boutiques, Ankara closed"},
        {"id": "a3", "speaker_id": OPERATOR, "speaker_role": "Boutique Manager", "supersedes_id": None,
         "kind": "statement", "claim_text": "I cover the boutiques myself and there are nine"},
    ]


def _yildirim_records() -> list[dict]:
    # Founder believes the yıldırım (rush) orders always ship same-day; a DIFFERENT speaker
    # (bench operator) supersedes that with the lived reality. Cross-speaker supersede must
    # stay comparable — that IS the gap.
    return [
        {"id": "b1", "speaker_id": CEO, "speaker_role": "Founder", "supersedes_id": None,
         "kind": "statement", "claim_text": "Yıldırım orders always ship the same day"},
        {"id": "b2", "speaker_id": OPERATOR, "speaker_role": "Bench Craftsperson", "supersedes_id": "b1",
         "kind": "statement", "claim_text": "Yıldırım orders often slip a day or two at the bench"},
    ]


def test_same_speaker_retraction_marks_only_the_retracted_claim():
    recs = {r["id"]: r for r in _mark_self_retracted(_boutique_records())}
    assert recs["a1"]["self_retracted"] is True     # the 12, retracted by its own author
    assert recs["a2"]["self_retracted"] is False    # the current 9 stands
    assert recs["a3"]["self_retracted"] is False


def test_retracted_claim_seeds_no_gap():
    recs = {r["id"]: r for r in _mark_self_retracted(_boutique_records())}
    # The retracted founder claim vs the operator: no gap (its author already corrected it).
    assert _valid_perception_gap(recs["a1"], recs["a3"]) is False


def test_cross_speaker_supersede_still_seeds_a_gap():
    recs = {r["id"]: r for r in _mark_self_retracted(_yildirim_records())}
    assert recs["b1"]["self_retracted"] is False    # superseded, but by a DIFFERENT speaker
    # Founder belief vs the bench operator's lived account: the gap survives.
    assert _valid_perception_gap(recs["b1"], recs["b2"]) is True


def test_current_corrected_claim_can_still_gap_if_floor_differs():
    # Sanity: the guard only kills the RETRACTED claim, not the corrected one. If the
    # founder's current "9" genuinely diverged from a floor account, that could still gap.
    recs = {r["id"]: r for r in _mark_self_retracted(_boutique_records())}
    assert recs["a2"]["self_retracted"] is False
