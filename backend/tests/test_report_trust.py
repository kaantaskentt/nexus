"""Company Report trust-tag honesty (pilot §3, leak 2). Deterministic, no DB, no model.

A hand-added record is capped CLAIMED internally but rendered in the export as an unlabeled
finding, and even spawned a whole exported workflow from that single claimed record. These
tests pin the two predicates the compose layer uses to decide where an honest qualifier is
shown. Tags never upgrade (non-negotiable #1); this is display honesty, not re-tagging.
"""

from app.routers.company_report import _is_unverified, _records_unverified


def test_finding_below_confirmed_is_unverified():
    # CLAIMED (hand-added cap), GUESS, SCRAPED and untagged all need a qualifier.
    assert _is_unverified("CLAIMED") is True
    assert _is_unverified("GUESS") is True
    assert _is_unverified("SCRAPED") is True
    assert _is_unverified(None) is True


def test_confirmed_and_verified_findings_are_not_qualified():
    assert _is_unverified("CONFIRMED") is False
    assert _is_unverified("VERIFIED") is False


def test_workflow_from_single_claimed_record_is_unverified():
    # Emre's exact case: a workflow spawned from ONE claimed record carries the qualifier.
    assert _records_unverified(["CLAIMED"]) is True
    assert _records_unverified(["CLAIMED", "GUESS", None]) is True
    assert _records_unverified([]) is True  # no backing at all → not an established process


def test_workflow_with_any_confirmed_backing_stands():
    assert _records_unverified(["CLAIMED", "CONFIRMED"]) is False
    assert _records_unverified(["VERIFIED"]) is False
