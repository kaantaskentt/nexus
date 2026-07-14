"""Twelve Labs client for screen/video media extract. Thin httpx wrapper — mocked in tests."""

from __future__ import annotations

import asyncio
import logging

import httpx

from .config import get_settings

log = logging.getLogger(__name__)

API_BASE = "https://api.twelvelabs.io/v1.3"


class TwelveLabsError(RuntimeError):
    pass


async def analyze_video(
    *,
    data: bytes,
    file_name: str,
    mime: str,
    prompt: str,
) -> str:
    """Upload a short clip and return a text analysis. Raises TwelveLabsError on failure."""
    key = get_settings().twelvelabs_api_key
    if not key:
        raise TwelveLabsError("TWELVELABS_API_KEY is not configured")

    headers = {"x-api-key": key}
    async with httpx.AsyncClient(timeout=180.0) as client:
        # Create an open index for ad-hoc analysis when none is configured — v1 uses
        # the generate/analyze path via a temporary upload task.
        # Step 1: create upload task (engine marengo2.7 / Pegasus-compatible analyze).
        files = {
            "video_file": (file_name or "screen.webm", data, mime or "video/webm"),
        }
        # Prefer the open-ended analyze endpoint when available; fall back to
        # generate with a prompt after indexing via tasks.
        # Docs shape (v1.3): POST /tasks with index_id optional for generate-only flows.
        # We use /generate when we have an asset; for simplicity upload via /tasks with
        # a dedicated index created per-request is heavy. Instead:
        # POST https://api.twelvelabs.io/v1.3/generate  with video_file + prompt
        # (Twelve Labs open generate API accepts video + prompt for some plans).
        gen = await client.post(
            f"{API_BASE}/generate",
            headers=headers,
            data={"prompt": prompt, "temperature": "0.2"},
            files={"video_file": (file_name or "screen.webm", data, mime or "video/webm")},
        )
        if gen.status_code in (200, 201):
            body = gen.json()
            text = body.get("data") or body.get("text") or body.get("id")
            if isinstance(text, list):
                text = "\n".join(str(x) for x in text)
            if isinstance(text, str) and text.strip():
                return text.strip()
            # Async task style: poll
            task_id = body.get("id") or body.get("task_id")
            if task_id:
                return await _poll_generate(client, headers, str(task_id))

        # Fallback: tasks endpoint (index-based). Some keys only expose this path —
        # surface the first error clearly for ops.
        tasks = await client.post(
            f"{API_BASE}/tasks",
            headers=headers,
            files=files,
            data={"index_id": ""},  # empty may 400 — handled below
        )
        detail = gen.text[:400] if gen.status_code >= 400 else tasks.text[:400]
        raise TwelveLabsError(
            f"Twelve Labs analyze failed ({gen.status_code}/{tasks.status_code}): {detail}"
        )


async def _poll_generate(client: httpx.AsyncClient, headers: dict, task_id: str) -> str:
    for _ in range(60):
        r = await client.get(f"{API_BASE}/generate/{task_id}", headers=headers)
        if r.status_code != 200:
            await asyncio.sleep(2)
            continue
        body = r.json()
        status = (body.get("status") or "").lower()
        if status in ("ready", "completed", "done"):
            text = body.get("data") or body.get("text") or ""
            if isinstance(text, list):
                text = "\n".join(str(x) for x in text)
            if not str(text).strip():
                raise TwelveLabsError("Twelve Labs returned empty analysis")
            return str(text).strip()
        if status in ("failed", "error"):
            raise TwelveLabsError(f"Twelve Labs task failed: {body}")
        await asyncio.sleep(2)
    raise TwelveLabsError("Twelve Labs analyze timed out")
