"""Provision (or update) the Nexus voice assistants on VAPI.

Sources: docs/voice-config.md (the settings that matter and why) · MERGE_PLAN Phase 5 / A5.

VAPI is pure transport (A5): every word of interview logic stays in our turn engine.
This script only registers assistants whose brain is our custom-LLM endpoint and whose
verbatim record comes from transcript webhooks. It is idempotent — assistants are keyed
by name, updated in place if they already exist, so re-running never duplicates.

Two assistants are created, identical except voice: one warm female, one warm male
(A11.4 voice selection is Kaan's; these are sensible warm-professional defaults using
VAPI's built-in Deepgram Aura voices, no extra provider credential needed).

Auth: VOICE_SHARED_SECRET travels as a raw Authorization header on BOTH the custom-LLM
model URL (model.headers) and the webhook (server.headers); the router checks equality.

Usage:
    python -m scripts.provision_vapi                       # uses APP_BASE_URL / default
    VOICE_PUBLIC_URL=https://host python -m scripts.provision_vapi
"""

import json
import os
import sys
import urllib.error
import urllib.request

VAPI_BASE = "https://api.vapi.ai"
DEFAULT_PUBLIC_URL = "https://nexus-api-production-d644.up.railway.app"

# Warm-professional defaults (Deepgram Aura, built into VAPI — no extra key). Kaan owns
# the final pick (A11.4); these are placeholders chosen for warmth, easy to swap.
VOICES = [
    ("Nexus Interviewer (F)", "asteria"),  # warm, friendly female (Deepgram Aura)
    ("Nexus Interviewer (M)", "orion"),    # approachable, warm male (Deepgram Aura)
]


def _public_url() -> str:
    return (os.environ.get("VOICE_PUBLIC_URL") or os.environ.get("APP_BASE_URL")
            or DEFAULT_PUBLIC_URL).rstrip("/")


def _assistant_config(name: str, voice_id: str, base_url: str, secret: str) -> dict:
    auth = {"Authorization": secret} if secret else {}
    return {
        "name": name,
        "model": {
            "provider": "custom-llm",
            # VAPI POSTs <url>/chat/completions for every turn; brain lives here.
            "url": f"{base_url}/api/voice",
            "model": "nexus-interviewer",
            "temperature": 1.0,
            "headers": auth,
        },
        # First turn: let our model generate the opener (turn engine owns the script).
        "firstMessageMode": "assistant-speaks-first-with-model-generated-message",
        # (1) VERBATIM — hedges are data; smart-formatting destroys the product.
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "smartFormat": False,
            "language": "en",
        },
        # (2) PATIENT ENDPOINTING — episodic recall needs thinking silence.
        "startSpeakingPlan": {
            "waitSeconds": 2.5,
            "smartEndpointingPlan": {"provider": "livekit"},
        },
        # (6) INTERRUPTION — yield immediately; never talk over the respondent.
        "stopSpeakingPlan": {"numWords": 1, "voiceSeconds": 0.2, "backoffSeconds": 1.0},
        # (7) SILENCE — long; the gentle check-in is the persona's job, not an auto hang-up.
        "silenceTimeoutSeconds": 30,
        "maxDurationSeconds": 3600,
        "voice": {"provider": "deepgram", "voiceId": voice_id},
        # (4) RECORDING + WEBHOOKS — raw audio + verbatim transcript are evidence.
        "artifactPlan": {"recordingEnabled": True, "videoRecordingEnabled": False},
        "server": {"url": f"{base_url}/api/voice/webhook", "headers": auth},
        "serverMessages": ["transcript", "end-of-call-report", "status-update"],
        # (5) MINIMAL analysis — the Stage 4 compiler is the single extraction authority.
        "analysisPlan": {
            "summaryPlan": {"enabled": False},
            "structuredDataPlan": {"enabled": False},
            "successEvaluationPlan": {"enabled": False},
        },
    }


def _req(method: str, path: str, key: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{VAPI_BASE}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    # api.vapi.ai sits behind Cloudflare, which 403s (error 1010) the default urllib
    # client signature; a normal browser User-Agent clears it.
    req.add_header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                 "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"VAPI {method} {path} -> {e.code}: {detail}")


def main() -> None:
    key = os.environ.get("VAPI_API_KEY", "")
    if not key:
        raise SystemExit("VAPI_API_KEY not set")
    secret = os.environ.get("VOICE_SHARED_SECRET", "")
    base_url = _public_url()
    if not secret:
        print("WARNING: VOICE_SHARED_SECRET empty — assistants will call unauthenticated endpoints")

    existing = _req("GET", "/assistant?limit=100", key)
    by_name = {a.get("name"): a.get("id") for a in existing if isinstance(a, dict)}

    print(f"Provisioning against {base_url}")
    for name, voice_id in VOICES:
        cfg = _assistant_config(name, voice_id, base_url, secret)
        if name in by_name:
            res = _req("PATCH", f"/assistant/{by_name[name]}", key, cfg)
            print(f"  updated {name}: id={res.get('id')} voice={voice_id}")
        else:
            res = _req("POST", "/assistant", key, cfg)
            print(f"  created {name}: id={res.get('id')} voice={voice_id}")


if __name__ == "__main__":
    sys.exit(main())
