"""Deep health (July 8): honest queue vitals — one DB read, no vendor calls."""

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_cors_allows_both_loopback_frontend_origins():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
            response = await client.options(
                "/health",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin


async def test_health_deep_reports_queue_vitals(db):
    await db.execute(
        "insert into jobs (kind, status, last_error, locked_at) "
        "values ('compile_session','failed','boom', now() - interval '90 seconds')")
    await db.execute("insert into jobs (kind, status) values ('rate_pain','queued')")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/health/deep")
    body = r.json()
    assert r.status_code == 200
    assert body["ok"] is False and body["failed_jobs"] == 1
    assert body["queued_jobs"] >= 1
    assert 60 <= body["last_error_age_s"] <= 600
