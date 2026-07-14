"""Nexus API — FastAPI skeleton. Routers own their domains; teammates extend."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_admin, require_workspace_seat, resolve_seat
from .config import get_brand, get_settings
from .db import close_pool, get_pool
from .routers import (
    artifacts,
    chat,
    claims,
    company_report,
    incidents,
    integrations,
    observer,
    plans,
    reports,
    sessions,
    simulations,
    voice,
    voice_config,
    workflows,
    workspaces,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


brand = get_brand()
app = FastAPI(title=f"{brand['product_name']} API", lifespan=lifespan)

_origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# P0-1: admin routers require a verified Supabase JWT. The gate is declared here, in one
# place, so it is obvious which surfaces are protected and which are deliberately public.
# Exceptions: `sessions` (mixed — its interviewee by-token routes are public, so it gates
# only eval-bootstrap internally) and `voice` (shared-secret gated).
_admin = [Depends(require_admin)]
# F6: workspace-scoped routers take the seat dependency. It wraps require_admin and
# scopes client seats to their own workspace (no row ⇒ admin, unchanged for operators) —
# flag on, a 'client' seat is confined to its own {workspace_id} routes.
_seat = [Depends(require_workspace_seat)]
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"], dependencies=_seat)
app.include_router(claims.router, prefix="/api/claims", tags=["claims"], dependencies=_seat)
app.include_router(plans.router, prefix="/api/plans", tags=["plans"], dependencies=_seat)
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
# voice_config: mixed gate like `sessions` — the editor routes carry require_admin, the
# by-token call-resolver stays public (the interviewee has no admin JWT). So no blanket dep.
app.include_router(voice_config.router, prefix="/api/voice-config", tags=["voice-config"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"], dependencies=_admin)
app.include_router(chat.router, prefix="/api/chat", tags=["chat"], dependencies=_seat)
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"], dependencies=_admin)
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"], dependencies=_seat)
app.include_router(observer.router, prefix="/api/observer", tags=["observer"], dependencies=_admin)
app.include_router(simulations.router, prefix="/api/simulations", tags=["simulations"], dependencies=_admin)
# R6: Section-7 harm-incident inbox — reviewer-scoped, admin-gated, never client-visible.
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"], dependencies=_admin)
# artifacts: mixed gate like `sessions` — by-token routes are public (the respondent has
# no JWT), the admin routes carry require_admin per-route.
app.include_router(artifacts.router, prefix="/api/artifacts", tags=["artifacts"])
# company report export (F2): mixed gate — mint requires admin, by-token is public
# (a share link IS the audience the admin chose).
app.include_router(company_report.router, prefix="/api/company-report", tags=["company-report"])


@app.get("/api/me")
async def me(user_id: str = Depends(require_admin)):
    """Who am I + which seat (F6). No user_roles row ⇒ admin; an explicit client
    row scopes the caller to that workspace."""
    seat = await resolve_seat(user_id)
    return {"user_id": user_id, **seat}


@app.get("/health")
async def health():
    return {"ok": True, "product": brand["product_name"]}


@app.get("/health/deep")
async def health_deep():
    """Deep health (Kaan queue item, July 8): honest queue vitals for the watchtower.
    No vendor calls — one DB round trip. failed = jobs that exhausted retries;
    last_error_age_s = seconds since the newest failure (null when none)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """select
             count(*) filter (where status = 'failed')  as failed,
             count(*) filter (where status = 'queued')  as queued,
             count(*) filter (where status = 'running') as running,
             extract(epoch from (now() - max(coalesce(locked_at, created_at)) filter (where status = 'failed'))) as last_error_age_s
           from jobs"""
    )
    # WS-5 (round-2 addendum §1): a provider outage is a LOUD, NAMED state. The worker
    # prefixes provider failures as PROVIDER_<KIND> on last_error; surface the freshest
    # one seen in the last 30 minutes so the admin banner can say the true thing
    # ("credits exhausted, work is queued") instead of three silent costumes.
    prov = await pool.fetchrow(
        """select substring(last_error from 'PROVIDER_[A-Z_]+') as kind, count(*) over () as n
             from jobs
            where last_error like 'PROVIDER_%'
              and coalesce(locked_at, created_at) > now() - interval '30 minutes'
            order by coalesce(locked_at, created_at) desc limit 1"""
    )
    return {
        "ok": row["failed"] == 0,
        "failed_jobs": row["failed"],
        "queued_jobs": row["queued"],
        "running_jobs": row["running"],
        "last_error_age_s": int(row["last_error_age_s"]) if row["last_error_age_s"] is not None else None,
        "provider_error": prov["kind"] if prov else None,
        "provider_error_jobs": prov["n"] if prov else 0,
    }
