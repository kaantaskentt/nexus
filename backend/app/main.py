"""Nexus API — FastAPI skeleton. Routers own their domains; teammates extend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_brand, get_settings
from .db import close_pool, get_pool
from .routers import chat, claims, plans, reports, sessions, voice, workflows, workspaces


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

app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
app.include_router(claims.router, prefix="/api/claims", tags=["claims"])
app.include_router(plans.router, prefix="/api/plans", tags=["plans"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])


@app.get("/health")
async def health():
    return {"ok": True, "product": brand["product_name"]}
