"""Extract mid-interview media shares → CLAIMED compile path.

- file / screenshot → Claude multimodal (media_extract_document)
- screen / video → Twelve Labs (media_extract_screen prompt as analyze brief)
Raw Storage blobs are retained (media_storage.delete_bytes must never run here).
"""

from __future__ import annotations

import base64
import json
import logging

from ..db import get_pool
from ..llm import client, extract_json, get_agent_config, load_prompt
from ..media_storage import MediaStorageError, get_bytes
from ..pipeline.compiler import _load_industry_block
from ..queue import enqueue, handles
from .. import twelvelabs as tl

log = logging.getLogger(__name__)


def _summary_from(data: dict, fallback: str) -> str:
    s = data.get("summary")
    if isinstance(s, str) and s.strip():
        return s.strip()[:800]
    obs = data.get("observations") or []
    if isinstance(obs, list) and obs:
        return "; ".join(str(x) for x in obs[:3])[:800]
    return fallback[:800]


def _observations_block(data: dict, file_name: str, kind: str) -> str:
    lines = [
        f"Shared media ({kind}): {file_name}",
        "",
        _summary_from(data, "Shared media observations."),
        "",
    ]
    for o in data.get("observations") or []:
        if isinstance(o, str) and o.strip():
            lines.append(f"- {o.strip()}")
    tools = [t for t in (data.get("tools_seen") or []) if isinstance(t, str) and t.strip()]
    if tools:
        lines.append("")
        lines.append("Tools seen: " + ", ".join(tools))
    steps = [s for s in (data.get("steps") or []) if isinstance(s, str) and s.strip()]
    if steps:
        lines.append("")
        lines.append("Steps:")
        for i, s in enumerate(steps, 1):
            lines.append(f"{i}. {s}")
    return "\n".join(lines).strip()


async def _extract_claude_document(
    *,
    data: bytes,
    mime: str,
    file_name: str,
    workspace_id: str,
    share_id: str,
    industry: str | None,
) -> dict:
    cfg = await get_agent_config("media_extract_document")
    system = load_prompt(cfg["prompt_path"], industry)
    b64 = base64.standard_b64encode(data).decode("ascii")
    mime_l = (mime or "image/png").lower()
    if mime_l.startswith("image/"):
        media_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": mime_l, "data": b64},
        }
    elif mime_l == "application/pdf":
        media_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        }
    else:
        # Plain text-ish: send as text only.
        try:
            text_body = data.decode("utf-8")
        except UnicodeDecodeError:
            text_body = f"[binary file {file_name}, mime={mime}, {len(data)} bytes — describe if possible from name only]"
        media_block = {"type": "text", "text": f"File contents of {file_name}:\n\n{text_body[:120000]}"}

    user_content = [
        media_block,
        {
            "type": "text",
            "text": (
                f"File name: {file_name}\nMime: {mime}\n"
                "Extract grounded observations as JSON per your instructions."
            ),
        },
    ]
    resp = await client().messages.create(
        model=cfg["model"],
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    try:
        return extract_json(text)
    except ValueError:
        return {"summary": text.strip()[:800], "observations": [text.strip()[:500]] if text.strip() else []}


async def _extract_twelvelabs_screen(
    *,
    data: bytes,
    mime: str,
    file_name: str,
    industry: str | None,
) -> dict:
    cfg = await get_agent_config("media_extract_screen")
    prompt = load_prompt(cfg["prompt_path"], industry)
    prompt = (
        prompt
        + "\n\nAnalyze this screen recording. Return ONLY the JSON object from your Output section."
    )
    raw = await tl.analyze_video(
        data=data, file_name=file_name or "screen.webm", mime=mime or "video/webm", prompt=prompt,
    )
    try:
        return extract_json(raw)
    except ValueError:
        return {"summary": raw[:800], "observations": [raw[:500]] if raw else [], "tools_seen": [], "steps": []}


async def extract_media_share(payload: dict) -> None:
    share_id = payload["share_id"]
    pool = await get_pool()
    row = await pool.fetchrow("select * from media_shares where id = $1", share_id)
    if row is None:
        log.info("extract_media_share: share %s gone — skipping", share_id)
        return
    if row["status"] == "ready":
        log.info("extract_media_share: share %s already ready — idempotent skip", share_id)
        return
    if row["status"] == "discarded":
        log.info("extract_media_share: share %s discarded — skipping", share_id)
        return

    # Firewall demo/test sessions the same way compile does.
    sess = await pool.fetchrow(
        "select session_kind, workspace_id from interview_sessions where id = $1",
        row["session_id"],
    )
    if sess is None:
        return
    if sess["session_kind"] in ("voice_test", "roleplay"):
        await pool.execute(
            """update media_shares set status = 'failed',
                 error = 'media extract firewalled for this session kind', updated_at = now()
               where id = $1""",
            share_id,
        )
        return

    if not row["storage_uri"]:
        await pool.execute(
            """update media_shares set status = 'failed', error = 'missing storage_uri',
                 updated_at = now() where id = $1""",
            share_id,
        )
        return

    await pool.execute(
        "update media_shares set status = 'extracting', error = null, updated_at = now() where id = $1",
        share_id,
    )

    try:
        blob = await get_bytes(row["storage_uri"])
    except MediaStorageError as e:
        await pool.execute(
            """update media_shares set status = 'failed', error = $2, updated_at = now()
               where id = $1""",
            share_id, str(e)[:500],
        )
        return

    industry = None
    try:
        ind = await pool.fetchval("select industry from workspaces where id = $1", row["workspace_id"])
        industry = _load_industry_block(ind)
    except Exception:
        industry = None

    kind = row["kind"]
    mime = row["mime"] or ""
    try:
        if kind == "screen" or mime.startswith("video/"):
            data = await _extract_twelvelabs_screen(
                data=blob, mime=mime, file_name=row["file_name"] or "screen.webm", industry=industry,
            )
        else:
            data = await _extract_claude_document(
                data=blob, mime=mime, file_name=row["file_name"] or "file",
                workspace_id=str(row["workspace_id"]), share_id=share_id, industry=industry,
            )
    except Exception as e:
        log.exception("extract_media_share: vendor failed for %s", share_id)
        await pool.execute(
            """update media_shares set status = 'failed', error = $2, updated_at = now()
               where id = $1""",
            share_id, str(e)[:500],
        )
        return

    # Retention check — never call delete on success (plan: do not remove raw files).
    # Tests monkeypatch media_storage.delete_bytes to count calls.
    extraction = _observations_block(data, row["file_name"] or "file", kind)
    grounding = _summary_from(data, extraction[:400])

    # Linked context session so interview transcript stays verbatim.
    ctx_sid = await pool.fetchval(
        """insert into interview_sessions
             (workspace_id, modality, status, session_kind, compile_max_tag)
           values ($1, 'text', 'completed', 'context', 'CLAIMED')
           returning id""",
        row["workspace_id"],
    )
    await pool.execute(
        """insert into utterances (session_id, turn_index, speaker, text)
           values ($1, 0, 'respondent', $2)""",
        ctx_sid, extraction,
    )
    job_id = await enqueue(
        "compile_session", {"session_id": str(ctx_sid), "max_tag": "CLAIMED"},
    )
    log.info(
        "extract_media_share: share %s → context session %s compile job %s",
        share_id, ctx_sid, job_id,
    )

    await pool.execute(
        """update media_shares
           set status = 'ready', extraction_text = $2, grounding_summary = $3,
               compile_session_id = $4, error = null, updated_at = now()
           where id = $1""",
        share_id, extraction, grounding, ctx_sid,
    )


@handles("extract_media_share")
async def _extract_media_share_job(payload: dict) -> None:
    await extract_media_share(payload)


async def grounding_for_session(session_id: str) -> str | None:
    """Short volatile block for the interviewer when ready shares exist."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select grounding_summary, kind, file_name from media_shares
           where session_id = $1 and status = 'ready'
             and grounding_summary is not null and grounding_summary != ''
           order by created_at desc limit 5""",
        session_id,
    )
    if not rows:
        return None
    lines = [
        "## Media the respondent shared in this interview",
        "These are extracted observations from files/screenshots/screen shares they uploaded.",
        "Ask about them when useful. Do not invent details beyond what is listed.",
        "",
    ]
    for r in rows:
        label = r["file_name"] or r["kind"]
        lines.append(f"- ({r['kind']}: {label}) {r['grounding_summary']}")
    return "\n".join(lines)
