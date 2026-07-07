"""People-map branch (stage-3 v04, merged A24): a people-map intake uploads through the
standard discovery path but is KIND-marked, requires a named subject, and never relabels
the workspace founder or snapshot source. Plus the artifact-ask authorization passthrough
into the handoff package."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import handoff
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _make_company(name="Bee Goddess", industry="jewelry", contact="Ece"):
    async with _client() as c:
        return (
            await c.post(
                "/api/workspaces",
                json={"name": name, "industry": industry, "contact_person": contact},
            )
        ).json()


async def test_people_map_upload_kind_marked_and_founder_untouched(db):
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={
                "transcript": "Meltem: I run Izmir. Ayşe does the repricing, Metin does packing.",
                "speaker_name": "Meltem",
                "speaker_role": "Regional manager",
                "session_kind": "people_map",
            },
        )
    assert r.status_code == 200
    sess = r.json()["session_id"]
    row = await db.fetchrow(
        "select session_kind from interview_sessions where id = $1::uuid", sess
    )
    assert row["session_kind"] == "people_map"
    label = await db.fetchval(
        "select label from interview_rounds where workspace_id = $1::uuid order by created_at desc limit 1",
        ws["id"],
    )
    assert label == "People-map interview"
    cfg = await db.fetchval("select config from workspaces where id = $1::uuid", ws["id"])
    cfg = json.loads(cfg) if isinstance(cfg, str) else (cfg or {})
    # A people-map intake never claims the founder seat or the snapshot source.
    assert cfg.get("founder") != "Meltem"
    assert cfg.get("source") != "CEO Discovery Call"


async def test_people_map_requires_named_speaker(db):
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={"transcript": "Someone: things happen.", "session_kind": "people_map"},
        )
    assert r.status_code == 422


async def test_bogus_session_kind_rejected(db):
    ws = await _make_company()
    async with _client() as c:
        r = await c.post(
            f"/api/workspaces/{ws['id']}/discovery",
            json={"transcript": "Ece: hi.", "session_kind": "surveillance"},
        )
    assert r.status_code == 422


async def test_artifact_authorization_passthrough(db):
    """mission.artifact_sharing_authorized reaches the handoff package as a bool;
    absent means False — the interviewer never invokes an uncaptured blessing."""
    ws = await make_workspace(db)
    for mission, expected in [
        ({"goal": "map packing", "artifact_sharing_authorized": True}, True),
        ({"goal": "map packing"}, False),
    ]:
        plan_id = await db.fetchval(
            "insert into interview_plans (workspace_id, state, mission) "
            "values ($1, 'APPROVED', $2) returning id",
            ws, json.dumps(mission),
        )
        package = await handoff.build_handoff_package(str(plan_id))
        assert package["artifact_sharing_authorized"] is expected
