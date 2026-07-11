"""WS-5 (round-2 addendum §1): provider failures are LOUD and NAMED end to end —
classified in llm, prefixed on the job's last_error with a heal-matched backoff, and
surfaced by /health/deep for the admin banner. Never again three silent costumes."""

import httpx as _httpx  # anthropic exceptions need request/response shims
from httpx import ASGITransport, AsyncClient

import anthropic

from app.llm import ProviderError, classify_provider_error
from app.main import app
from app.queue import _claim_one, _handlers, enqueue, record_job_failure


def _api_error(status: int, message: str) -> anthropic.APIStatusError:
    req = _httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    resp = _httpx.Response(status, request=req, json={"error": {"message": message}})
    return anthropic.APIStatusError(message, response=resp, body=None)


def test_classify_credit_exhaustion():
    e = _api_error(400, "Your credit balance is too low to access the Anthropic API.")
    named = classify_provider_error(e)
    assert isinstance(named, ProviderError)
    assert named.kind == "credits_exhausted"
    assert str(named).startswith("PROVIDER_CREDITS_EXHAUSTED")


def test_classify_auth_rate_limit_overload_and_unknown():
    assert classify_provider_error(_api_error(401, "invalid x-api-key")).kind == "auth"
    assert classify_provider_error(_api_error(429, "rate limit")).kind == "rate_limited"
    assert classify_provider_error(_api_error(529, "overloaded")).kind == "overloaded"
    # A plain 400 (bad request, not credits) is NOT a provider outage.
    assert classify_provider_error(_api_error(400, "max_tokens too large")) is None
    assert classify_provider_error(RuntimeError("boom")) is None


async def _run_one_job(db):
    """Claim + run exactly one job through the REAL worker failure path."""
    job = await _claim_one("test-worker")
    assert job is not None
    handler = _handlers[job["kind"]]
    try:
        await handler(job["payload"])
        await db.execute("update jobs set status='done' where id=$1", job["id"])
    except Exception as e:
        await record_job_failure(db, job, e)


async def test_worker_names_credit_error_and_backs_off(db):
    calls = {"n": 0}

    async def _credit_handler(payload):
        calls["n"] += 1
        raise _api_error(400, "Your credit balance is too low to access the Anthropic API.")

    _handlers["_test_credit_job"] = _credit_handler
    try:
        await enqueue("_test_credit_job", {})
        await _run_one_job(db)
        row = await db.fetchrow(
            "select last_error, status, extract(epoch from (run_after - now())) as wait "
            "from jobs where kind='_test_credit_job'")
        assert row["last_error"].startswith("PROVIDER_CREDITS_EXHAUSTED")
        assert row["status"] == "queued"  # retries stay — top-up completes queued work
        assert row["wait"] > 250  # 5 min backoff, not the 30s thrash
    finally:
        _handlers.pop("_test_credit_job", None)


async def test_health_deep_surfaces_provider_error(db):
    await db.execute(
        "insert into jobs (kind, payload, status, last_error, locked_at) "
        "values ('compile_session', '{}', 'queued', "
        "'PROVIDER_CREDITS_EXHAUSTED: Anthropic API credit balance is too low', now())")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/health/deep")
    body = r.json()
    assert body["provider_error"] == "PROVIDER_CREDITS_EXHAUSTED"
    assert body["provider_error_jobs"] >= 1


async def test_concurrent_loops_never_double_claim(db):
    """P1-1: N loops share the queue via SKIP LOCKED — the same job can never be claimed
    twice. Simulate two loops racing _claim_one on a single queued job."""
    import asyncio

    await enqueue("_test_race_job", {})
    a, b = await asyncio.gather(_claim_one("w-1"), _claim_one("w-2"))
    claimed = [j for j in (a, b) if j is not None]
    assert len(claimed) == 1
    assert claimed[0]["kind"] == "_test_race_job"


async def test_zombie_running_jobs_requeued(db):
    """Lease recovery: a 'running' job whose worker died (stale locked_at) is requeued;
    a genuinely-running fresh claim is left alone."""
    from app.queue import requeue_zombie_jobs

    await db.execute(
        "insert into jobs (kind, payload, status, locked_at, locked_by, attempts) "
        "values ('compile_session', '{}', 'running', now() - interval '45 minutes', 'dead-worker', 1)")
    await db.execute(
        "insert into jobs (kind, payload, status, locked_at, locked_by, attempts) "
        "values ('compile_session', '{}', 'running', now() - interval '2 minutes', 'alive-worker', 1)")

    n = await requeue_zombie_jobs(older_than_minutes=30)
    assert n == 1
    rows = await db.fetch("select status, locked_by from jobs where kind='compile_session' order by id")
    assert [r["status"] for r in rows] == ["queued", "running"]
    assert rows[0]["locked_by"] is None
