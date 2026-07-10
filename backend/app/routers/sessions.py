"""Interview sessions — token entry, turn engine mount point (Phase 4/5).
run_interview_turn is transport-agnostic: text chat and VAPI both land here."""

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import require_admin
from ..config import get_settings
from ..db import get_pool
from ..pipeline import deletion
from ..pipeline.interview import run_interview_turn, stream_interview_turn
from ..pipeline.live_capture import extraction_in_flight
from ..queue import enqueue
from .plans import reconcile_plan_state

router = APIRouter()

EVAL_WORKSPACE_SLUG = "eval-harness"


async def _session_for_token(token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """select id, workspace_id, status, modality, language, resumable_state, session_kind
           from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if row is None:
        raise HTTPException(404, "invalid or expired invite")
    return row


async def _consent_context(session_row) -> dict:
    """Merge fields for the consent landing page. The interview TOPIC is the neutral
    area from the plan mission — the same value the invite's {{INTERVIEW_TOPIC}} used —
    sourced from the plan/handoff, NEVER from claim text or who-said-what (non-negotiable
    #2). Names/company are respondent-facing identity only (F4: names + roles)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """select w.name as company_name, w.config as ws_config,
                  e.canonical_name as respondent_name,
                  p.mission as mission, h.package as package
           from interview_sessions s
           join workspaces w on w.id = s.workspace_id
           left join entities e on e.id = s.interviewee_id
           left join interview_plans p on p.id = s.plan_id
           left join handoff_packages h on h.plan_id = s.plan_id
           where s.id = $1""",
        session_row["id"],
    )
    mission = row["mission"] if row else None
    mission = json.loads(mission) if isinstance(mission, str) else (mission or {})
    package = row["package"] if row else None
    package = json.loads(package) if isinstance(package, str) else (package or {})
    ws_config = row["ws_config"] if row else None
    ws_config = json.loads(ws_config) if isinstance(ws_config, str) else (ws_config or {})

    first_name = (row["respondent_name"].split()[0] if row and row["respondent_name"] else None)
    topic = mission.get("interview_topic") or mission.get("goal")  # neutral, plan-sourced
    est = package.get("time_budget_minutes") or mission.get("time_budget_minutes") or 30
    return {
        "respondent_first_name": first_name,
        "company_name": row["company_name"] if row else None,
        "admin_name": ws_config.get("admin_name"),
        "topic": topic,
        "est_minutes": est,
        "modality": session_row["modality"],
    }


@router.get("/by-token/{token}")
async def get_by_token(token: str):
    """Session + consent context + the respondent's OWN transcript so far (their words,
    their screen — A21 target 4). The transcript makes modality switches and reconnects
    lossless in the UI: a voice call continued by text renders the whole thread, and a
    reloaded page never presents a started interview as fresh."""
    session = await _session_for_token(token)
    pool = await get_pool()
    turns = await pool.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index",
        session["id"],
    )
    out = {
        **dict(session),
        "context": await _consent_context(session),
        "transcript": [{"speaker": t["speaker"], "text": t["text"]} for t in turns],
    }
    # Admin test mode (P0-C): a voice_test call gets a way back to Voice Settings; an
    # F8 roleplay run goes back to Simulations. ONLY for admin test kinds — real
    # respondents stay chrome-free and never learn admin routes.
    if session["session_kind"] in ("voice_test", "roleplay"):
        slug = await pool.fetchval(
            "select slug from workspaces where id = $1", session["workspace_id"]
        )
        out["test_mode"] = True
        section = "settings" if session["session_kind"] == "voice_test" else "simulations"
        out["test_back_path"] = f"/w/{slug}/{section}"
    # SIMPLIFY I: a roleplay session minted from a workflow is a SIMULATION. Expose the
    # scenario label so the room shows the persistent "practice run" marker + suppresses the
    # Captured-live panel. Label only — no objectives reach the client (they'd hint the
    # interviewer's steer to the human player, muddying the test).
    if session["session_kind"] == "roleplay":
        state = session["resumable_state"]
        state = json.loads(state) if isinstance(state, str) else (state or {})
        sc = (state or {}).get("scenario")
        if isinstance(sc, dict) and sc.get("label"):
            out["simulation"] = {"label": sc["label"]}
    # F7 BETA: the context call room labels itself (BETA chip in the client) — the
    # caller is the client's founder/admin, so no admin chrome, just the honest label.
    # The done page deep-links them to the snapshot their call just built, so expose the
    # workspace slug — and ONLY the slug (SIMPLIFY G). Gated to the context kind: an
    # employee respondent never learns a workspace route.
    if session["session_kind"] == "context":
        out["context_call"] = True
        out["workspace_slug"] = await pool.fetchval(
            "select slug from workspaces where id = $1", session["workspace_id"]
        )
        # Does this workspace already have a rendered snapshot? Distinguishes a FIRST context
        # call (no cards yet — done page says "View company snapshot") from a LATER one (cards
        # exist — "See what's new in your snapshot"). A boolean only: no counts, names, or
        # config reach the respondent, and it is context-kind gated like the slug.
        out["snapshot_exists"] = await pool.fetchval(
            "select exists(select 1 from snapshot_cards where workspace_id = $1)",
            session["workspace_id"],
        )
    return out


class TurnIn(BaseModel):
    message: str | None = None  # None on the opening call — the interviewer speaks first


@router.post("/by-token/{token}/turn")
async def take_turn(token: str, body: TurnIn):
    """Text-chat turn keyed by invite token. Single-session binding + expiry are in
    the token lookup; a completed/expired session is closed and won't accept turns."""
    session = await _session_for_token(token)
    if session["status"] in ("completed", "expired"):
        raise HTTPException(409, f"interview already {session['status']}")
    result = await run_interview_turn(str(session["id"]), body.message)
    return result


@router.post("/by-token/{token}/turn/stream")
async def take_turn_stream(token: str, body: TurnIn):
    """Streaming twin of /turn (SIMPLIFY E): SSE frames carry the interviewer's reply
    token-by-token so words appear as they generate instead of dots for 3-7s. The
    non-streaming /turn stays the fallback (the client retries there on any stream error).
    Same session binding + expiry as /turn. Frames: {'type':'delta','text':...} per token,
    a final {'type':'done', ...} with turn metadata, or {'type':'error'} if generation
    failed BEFORE any turn was finalized (no half-turn is ever persisted)."""
    session = await _session_for_token(token)
    if session["status"] in ("completed", "expired"):
        raise HTTPException(409, f"interview already {session['status']}")

    async def sse():
        try:
            async for event in stream_interview_turn(str(session["id"]), body.message):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception:
            # Honest failure: the reply was not finalized, so the client can safely retry
            # the same turn on the non-streaming endpoint (its own message re-send guard
            # prevents a double respondent turn).
            yield f"data: {json.dumps({'type': 'error'})}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


# ── Live captures (SIMPLIFY E) — the "Captured live" panel's data ───────────────
# STRUCTURAL session-scoped display items (teams/systems/workflows/decision rules/goals/
# open questions), written by the per-turn extractor. NOT claim records — never the KB.


async def _live_captures(pool, session_id) -> list[dict]:
    rows = await pool.fetch(
        """select id, kind, label, detail, status, created_at
           from live_captures where session_id = $1 order by created_at, id""",
        session_id,
    )
    return [
        {
            "id": str(r["id"]),
            "kind": r["kind"],
            "label": r["label"],
            "detail": r["detail"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/by-token/{token}/live-captures")
async def live_captures_by_token(token: str):
    """Respondent view — R1 audience split (Kaan): the respondent sees ONLY that capture is
    happening (a live COUNT + the real extraction heartbeat), NEVER the captured items. A
    respondent who watches their words become records starts performing for the record
    (Emre), so the item content must not reach their browser to be hidden in the UI — this
    payload carries a COUNT ONLY. Item content is admin vocabulary, served solely by the
    require_admin `/{session_id}/live-captures` endpoint below. Audience is a property of the
    ROUTE (by-token = respondent), never a client flag. `extracting` is a REAL in-flight
    signal, never a faked 'Saving' state."""
    session = await _session_for_token(token)
    pool = await get_pool()
    return {
        "count": await pool.fetchval(
            "select count(*) from live_captures where session_id = $1", session["id"]
        ),
        "extracting": await extraction_in_flight(pool, session["id"]),
    }


@router.get("/{session_id}/live-captures", dependencies=[Depends(require_admin)])
async def live_captures_admin(session_id: str):
    """Admin/Observer view of the same items. A live capture is single-source, so it maps
    through the real trust ladder to Reported at most (A18/A19) — a fixed, derived badge,
    never a stored tag. Same items, same honesty, one extra column of vocabulary the admin
    is allowed to see."""
    pool = await get_pool()
    if not await pool.fetchval("select 1 from interview_sessions where id = $1", session_id):
        raise HTTPException(404, "no such session")
    items = await _live_captures(pool, session_id)
    for it in items:
        it["ladder"] = "reported"  # live single-source floor — never higher (A18)
    return {
        "items": items,
        "extracting": await extraction_in_flight(pool, session_id),
    }


@router.post("/by-token/{token}/pause")
async def pause(token: str):
    session = await _session_for_token(token)
    pool = await get_pool()
    await pool.execute(
        "update interview_sessions set status = 'paused' where id = $1 and status = 'active'",
        session["id"],
    )
    return {"status": "paused", "resumes_on": "same link"}


@router.post("/by-token/{token}/complete")
async def complete(token: str):
    """Finish a text interview: mark it completed and enqueue the Stage 4 compile
    (the voice path does this from the end-of-call webhook; text needs an explicit
    finish). Idempotent — a re-complete won't double-enqueue an already-closed one."""
    session = await _session_for_token(token)
    pool = await get_pool()
    if session["status"] == "completed":
        return {"status": "completed", "compile": "already queued"}
    plan_id = await pool.fetchval(
        "select plan_id from interview_sessions where id = $1", session["id"]
    )
    await pool.execute(
        "update interview_sessions set status = 'completed', ended_at = now() where id = $1",
        session["id"],
    )
    # Advance the plan in lockstep so it can't read "Sent" while its interview is done
    # (YC-AUDIT #7). COMPILED lands when the compile job finishes, in compiler.py.
    await reconcile_plan_state(pool, plan_id, "COMPLETED", "interview completed")
    # F7: a context call is the CEO/discovery-class call (plan-less by construction),
    # so its compile auto-renders the snapshot exactly like the transcript upload does.
    # The A3 guardrail in _should_render_snapshot still holds (flag + plan-less both).
    compile_payload = {"session_id": str(session["id"])}
    if session["session_kind"] == "context":
        compile_payload["render_snapshot"] = True
    await enqueue("compile_session", compile_payload)
    # Disclosure screen runs beside the compile, never inside it — a failed compile
    # must not skip the Tier-2 sealed-flag pass (Emre stage-7 §7, A24).
    await enqueue("screen_disclosures", {"session_id": str(session["id"])})
    # Artifact promises (Kaan F1, July 8): same seam — offers to share materials are
    # recorded even when the compile fails, so the done page can honor them.
    await enqueue("scan_artifact_promises", {"session_id": str(session["id"])})
    return {"status": "completed", "compile": "queued"}


class EvalBootstrapIn(BaseModel):
    handoff: dict
    modality: str = "text"
    language: str = "en"


@router.post("/eval-bootstrap", dependencies=[Depends(require_admin)])
async def eval_bootstrap(body: EvalBootstrapIn):
    """Test-only: mint an is_demo session from a handoff package so the eval harness
    can drive the real turn engine. Double-gated per A12: refused unless EVAL_MODE is
    on, and it only ever touches the is_demo eval workspace — never a real tenant."""
    if not get_settings().eval_mode:
        raise HTTPException(403, "eval-bootstrap disabled (set EVAL_MODE=1)")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        ws = await conn.fetchval("select id from workspaces where slug = $1", EVAL_WORKSPACE_SLUG)
        if ws is None:
            ws = await conn.fetchval(
                # is_internal: the eval tenant must never surface in the client-facing
                # picker (Kaan verdict 5, July 7 — he saw "Eval Harness" and was confused).
                "insert into workspaces (name, slug, industry, is_demo, is_internal) "
                "values ('Eval Harness', $1, 'jewelry', true, true) returning id",
                EVAL_WORKSPACE_SLUG,
            )
        # A throwaway plan carries the posted package; the turn engine loads it by plan_id.
        plan_id = await conn.fetchval(
            "insert into interview_plans (workspace_id, state) values ($1, 'APPROVED') returning id",
            ws,
        )
        await conn.execute(
            "insert into handoff_packages (plan_id, package) values ($1, $2)",
            plan_id,
            json.dumps(body.handoff),
        )
        token = secrets.token_urlsafe(24)
        await conn.execute(
            """insert into interview_sessions
                 (workspace_id, plan_id, modality, language, invite_token, status, session_kind)
               values ($1, $2, $3, $4, $5, 'pending', 'eval')""",
            ws, plan_id, body.modality, body.language, token,
        )
    return {"token": token}


# ── Interview deletion (Kaan P2, July 9) — admin-gated on this mixed router ─────
# Two-step by design: the preview feeds the warning dialog with EXACT counts (the
# dialog is the feature, not a nicety); the delete runs the documented full cascade
# (app/pipeline/deletion.py — records go from the Knowledge Base too).


@router.get("/{session_id}/delete-preview", dependencies=[Depends(require_admin)])
async def delete_preview(session_id: str):
    out = await deletion.preview_interview_delete(session_id)
    if out is None:
        raise HTTPException(404, "no such session")
    if not out.get("deletable"):
        raise HTTPException(422, out.get("reason", "this session cannot be deleted"))
    return out


@router.delete("/{session_id}", dependencies=[Depends(require_admin)])
async def delete_session(session_id: str):
    out = await deletion.delete_interview(session_id)
    if out is None:
        raise HTTPException(404, "no such session")
    if not out.get("deletable"):
        raise HTTPException(422, out.get("reason", "this session cannot be deleted"))
    return out
