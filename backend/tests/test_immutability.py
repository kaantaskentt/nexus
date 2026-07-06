"""The ontology's spine: records are immutable, sentiment is quarantined at the
data layer. These test the DB triggers directly — prompt discipline is not trusted."""

import asyncpg
import pytest

from tests.conftest import make_session, make_workspace


async def _insert_claim(pool, workspace_id, session_id, **over):
    fields = dict(
        kind="statement",
        topic="time_or_cost",
        tag="CLAIMED",
        claim_text="Packing takes 40 minutes",
        sentiment_flag=False,
    )
    fields.update(over)
    return await pool.fetchval(
        """insert into claim_records
             (workspace_id, session_id, kind, topic, tag, claim_text, sentiment_flag)
           values ($1,$2,$3,$4,$5,$6,$7) returning id""",
        workspace_id,
        session_id,
        fields["kind"],
        fields["topic"],
        fields["tag"],
        fields["claim_text"],
        fields["sentiment_flag"],
    )


async def test_tag_update_is_rejected(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    cid = await _insert_claim(db, ws, sess, tag="CLAIMED")
    with pytest.raises(asyncpg.PostgresError, match="immutable"):
        await db.execute("update claim_records set tag = 'CONFIRMED' where id = $1", cid)
    # unchanged
    assert await db.fetchval("select tag from claim_records where id = $1", cid) == "CLAIMED"


async def test_claim_text_update_is_rejected(db):
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    cid = await _insert_claim(db, ws, sess)
    with pytest.raises(asyncpg.PostgresError, match="immutable"):
        await db.execute("update claim_records set claim_text = 'edited' where id = $1", cid)


async def test_mention_count_and_supersedes_are_mutable(db):
    """The counters that MUST move — mention_count and supersedes_id — are allowed."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    original = await _insert_claim(db, ws, sess)
    correction = await _insert_claim(db, ws, sess, claim_text="Packing takes 10 minutes")
    await db.execute("update claim_records set mention_count = 3 where id = $1", original)
    await db.execute(
        "update claim_records set supersedes_id = $2 where id = $1", correction, original
    )
    assert await db.fetchval(
        "select supersedes_id from claim_records where id = $1", correction
    ) == original


async def test_sentiment_is_quarantined_at_insert(db):
    """A sentiment record inserted un-quarantined is force-locked by the trigger and
    never surfaces through client_visible_claims (non-negotiable #4)."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    cid = await db.fetchval(
        """insert into claim_records
             (workspace_id, session_id, kind, topic, tag, claim_text,
              sentiment_flag, quarantined)
           values ($1,$2,'statement','person','CLAIMED','Burak is slow', true, false)
           returning id""",
        ws,
        sess,
    )
    assert await db.fetchval("select quarantined from claim_records where id = $1", cid) is True
    visible = await db.fetchval(
        "select count(*) from client_visible_claims where id = $1", cid
    )
    assert visible == 0
