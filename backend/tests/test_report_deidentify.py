"""Company Report re-identification pass (pilot §3, leak 1). Deterministic, no DB, no model.

The report attributes findings by ROLE. A role mask is transparent the moment the same
forwardable page also NAMES a person in a finding body / next step / workflow step. These
tests pin the invariant: after the compose-time de-identification pass, no known person name
survives anywhere in a payload whose findings are role-attributed. A12: fictional company.
"""

import re

from app.routers.company_report import _deidentify, _name_variants, _redactions, _scrub

PEOPLE = [
    {"canonical_name": "Burak Demir", "aliases": [], "role": "operations lead"},
    {"canonical_name": "Selin Kaya", "aliases": ["Selin"], "role": "returns lead"},
    {"canonical_name": "Ayşe Bilmemne", "aliases": [], "role": "client coordinator"},
    {"canonical_name": "Rifat", "aliases": [], "role": None},  # role-less → "a colleague"
]

NAMES = ["Burak", "Demir", "Selin", "Kaya", "Ayşe", "Bilmemne", "Rifat"]


def _leaks_identity(payload: dict) -> bool:
    """The exact failure Emre flagged: a role-attributed pain co-occurring with a personal
    name anywhere on the same page. True iff any finding is role-attributed AND any known
    person name appears anywhere in the payload's text."""
    role_attributed = any(f.get("role") for f in payload.get("key_findings", []))
    blob = repr(payload)
    named = any(re.search(rf"\b{re.escape(n)}\b", blob, re.IGNORECASE) for n in NAMES)
    return role_attributed and named


def _sample_payload() -> dict:
    return {
        "key_findings": [
            {"text": "Burak is the only one who runs repricing on his personal Excel.",
             "role": "operations", "tag": "CONFIRMED"},
        ],
        "workflows": [
            {"name": "Returns handling",
             "steps": [{"index": 0, "title": "Route returns questions to Selin"}]},
        ],
        "next_steps": [
            {"kind": "follow_up", "text": "owner: Burak Demir"},
            {"kind": "interview", "text": "Schedule interviews with the returns lead"},
        ],
        "snapshot": [
            {"card_type": "learned",
             "content": {"title": "Client relations", "body": "Ayşe Bilmemne holds it together."}},
        ],
    }


def test_name_variants_cover_full_and_token():
    variants = _name_variants("Ayşe Bilmemne", [])
    assert "Ayşe Bilmemne" in variants
    assert "Ayşe" in variants and "Bilmemne" in variants
    # Longest first, so the full name redacts before a bare token can strand a fragment.
    assert variants[0] == "Ayşe Bilmemne"


def test_scrub_replaces_name_with_role():
    reds = _redactions(PEOPLE)
    assert _scrub("owner: Burak Demir", reds) == "owner: the operations lead"
    assert _scrub("route returns questions to Selin", reds) == "route returns questions to the returns lead"
    # Role-less person → neutral placeholder, never the bare name.
    assert _scrub("ask Rifat first", reds) == "ask a colleague first"


def test_raw_payload_leaks_but_deidentified_does_not():
    reds = _redactions(PEOPLE)
    raw = _sample_payload()
    # The guard bites on the raw payload — role-attributed finding + personal names present.
    assert _leaks_identity(raw) is True

    clean = {k: _deidentify(v, reds) for k, v in raw.items()}
    # After the pass: findings are still role-attributed, but NO name survives anywhere.
    assert any(f.get("role") for f in clean["key_findings"])
    assert _leaks_identity(clean) is False
    # Spot-check the specific leaks Emre named.
    assert "Burak" not in repr(clean)
    assert "Selin" not in repr(clean)
    assert "Ayşe" not in repr(clean)


def test_deidentify_preserves_non_name_text():
    reds = _redactions(PEOPLE)
    # A word that is nobody's name is untouched; structure (dicts/lists/ints) survives.
    payload = {"a": ["repricing runs weekly", 12], "b": {"c": "the operations lead owns it"}}
    assert _deidentify(payload, reds) == payload
