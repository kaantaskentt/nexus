"""Nexus API — FastAPI skeleton. Routers own their domains; teammates extend."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_admin
from .config import get_brand, get_settings
from .db import close_pool, get_pool
from .routers import (
    artifacts,
    chat,
    claims,
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
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"], dependencies=_admin)
app.include_router(claims.router, prefix="/api/claims", tags=["claims"], dependencies=_admin)
app.include_router(plans.router, prefix="/api/plans", tags=["plans"], dependencies=_admin)
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
# voice_config: mixed gate like `sessions` — the editor routes carry require_admin, the
# by-token call-resolver stays public (the interviewee has no admin JWT). So no blanket dep.
app.include_router(voice_config.router, prefix="/api/voice-config", tags=["voice-config"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"], dependencies=_admin)
app.include_router(chat.router, prefix="/api/chat", tags=["chat"], dependencies=_admin)
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"], dependencies=_admin)
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"], dependencies=_admin)
app.include_router(observer.router, prefix="/api/observer", tags=["observer"], dependencies=_admin)
app.include_router(simulations.router, prefix="/api/simulations", tags=["simulations"], dependencies=_admin)
# artifacts: mixed gate like `sessions` — by-token routes are public (the respondent has
# no JWT), the admin routes carry require_admin per-route.
app.include_router(artifacts.router, prefix="/api/artifacts", tags=["artifacts"])


@app.get("/health")
async def health():
    return {"ok": True, "product": brand["product_name"]}
