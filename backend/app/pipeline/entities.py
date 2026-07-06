"""Entity registry (EK 2.1) — resolve call-mentioned names against the workspace
people pool, or mint a NEW-PERSON.

Hard invariant (non-negotiable, spec §Entity registry): vendor-side people can
NEVER be created from a client transcript. Every entity this module mints from a
call is `is_vendor_side = false`, unconditionally — the flag is not taken from the
LLM. Vendor entities are seeded by other means (manual/config), never here."""

import re
from difflib import SequenceMatcher

from ..db import get_pool

_TITLE = re.compile(r"^(mr|mrs|ms|dr|sn|sayın|bay|bayan)\.?\s+", re.IGNORECASE)


def normalize_name(name: str) -> str:
    name = _TITLE.sub("", name.strip())
    return re.sub(r"\s+", " ", name).strip().lower()


def _matches(mentioned: str, canonical: str, aliases: list[str]) -> bool:
    m = normalize_name(mentioned)
    c = normalize_name(canonical)
    if not m:
        return False
    if m == c or m in {normalize_name(a) for a in aliases}:
        return True
    # First-name-only mentions ("Burak" → "Burak Yılmaz"): a single spoken token
    # that heads the canonical name (or vice versa) is the same person.
    mt, ct = m.split(), c.split()
    if len(mt) == 1 and ct and mt[0] == ct[0]:
        return True
    if len(ct) == 1 and mt and ct[0] == mt[0]:
        return True
    return SequenceMatcher(None, m, c).ratio() >= 0.88


async def resolve_or_create(
    workspace_id: str,
    name: str,
    *,
    role: str | None = None,
    entity_type: str = "person",
) -> tuple[str, bool]:
    """Returns (entity_id, is_new). Matches against canonical_name + aliases in the
    workspace pool; mints a client-side NEW-PERSON when nothing matches."""
    if not name or not name.strip():
        raise ValueError("cannot resolve an empty name")
    pool = await get_pool()
    rows = await pool.fetch(
        "select id, canonical_name, aliases from entities "
        "where workspace_id = $1 and entity_type = $2",
        workspace_id,
        entity_type,
    )
    for r in rows:
        if _matches(name, r["canonical_name"], list(r["aliases"])):
            return str(r["id"]), False

    # NEW-PERSON — always client-side, source=interview. is_vendor_side is hardcoded
    # false: a client transcript cannot create a vendor entity, full stop.
    row = await pool.fetchrow(
        """insert into entities (workspace_id, entity_type, canonical_name, role,
               is_vendor_side, source)
           values ($1, $2, $3, $4, false, 'interview')
           returning id""",
        workspace_id,
        entity_type,
        name.strip(),
        role,
    )
    return str(row["id"]), True
