"""Internal scaffolding must never surface on client-facing lists (#22 + #20 review):
is_internal workspaces are hidden from the picker; non-interview session_kinds
(context/eval) are excluded from a workspace's session list."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_list_workspaces_hides_internal(db):
    visible = await make_workspace(db, industry="jewelry")
    internal = await make_workspace(db, industry="jewelry")
    await db.execute("update workspaces set is_internal = true where id = $1", internal)

    async with _client() as c:
        rows = (await c.get("/api/workspaces")).json()
    ids = {r["id"] for r in rows}
    assert str(visible) in ids
    assert str(internal) not in ids


async def test_list_sessions_excludes_non_interview_kinds(db):
    # The interview-kind row carries an invite token: since WS-4b the interviews list also
    # drops plan-less token-less rows (paste-upload compile vehicles), and this test's
    # subject is the KIND filter, so its interview row is a real invite-keyed one.
    ws = await make_workspace(db, industry="jewelry")
    for kind, token in (("interview", "tok-kind-test"), ("context", None), ("eval", None)):
        await db.execute(
            "insert into interview_sessions (workspace_id, modality, status, session_kind, invite_token) "
            "values ($1, 'text', 'completed', $2, $3)",
            ws, kind, token,
        )
    async with _client() as c:
        rows = (await c.get(f"/api/workspaces/{ws}/sessions")).json()
    assert len(rows) == 1  # only the real interview


async def test_list_sessions_kind_param_selects_eval_runs(db):
    """The Simulations surface (A21) lists eval-kind runs explicitly via ?kind=eval —
    still firewalled: each kind only ever sees itself, and junk kinds are rejected."""
    ws = await make_workspace(db, industry="jewelry")
    for kind in ("interview", "eval"):
        await db.execute(
            "insert into interview_sessions (workspace_id, modality, status, session_kind) "
            "values ($1, 'text', 'completed', $2)",
            ws, kind,
        )
    async with _client() as c:
        evals = (await c.get(f"/api/workspaces/{ws}/sessions?kind=eval")).json()
        bad = await c.get(f"/api/workspaces/{ws}/sessions?kind=everything")
    assert len(evals) == 1
    assert evals[0]["session_kind"] == "eval"
    assert bad.status_code == 422
