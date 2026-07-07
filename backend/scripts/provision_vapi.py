"""Provision (or update) the Nexus voice assistants on VAPI.

Sources: docs/voice-config.md (the settings that matter and why) · MERGE_PLAN Phase 5 / A5.

VAPI is pure transport (A5): every word of interview logic stays in our turn engine.
This script only registers assistants whose brain is our custom-LLM endpoint and whose
verbatim record comes from transcript webhooks. It is idempotent — assistants are keyed
by name, updated in place if they already exist, so re-running never duplicates.

Two shared assistants are created. Since A20 (Kaan's July 7 casting verdict) BOTH carry
the global default voice — ElevenLabs "ryan", turbo v2.5, with the canned fast opener and
the humanizing turn-taking block — so re-running this script preserves, never reverts,
the live default. The F/M pair survives as fallback slots for gender-tagged workspace
configs that never synced.

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

# The global default voice (A20 — Kaan's casting pick): ElevenLabs "ryan", turbo v2.5,
# with the exact casting-winner settings. Keep in sync with app/vapi_assistant.voice_block.
RYAN_VOICE = {
    "provider": "11labs",
    "voiceId": "ryan",
    "model": "eleven_turbo_v2_5",
    "stability": 0.45,
    "similarityBoost": 0.75,
    "style": 0.0,
    "useSpeakerBoost": True,
    "optimizeStreamingLatency": 3,
    "speed": 1.0,
}
# The canned fast opener (A20) — static text speaks instantly; the model-generated mode
# was the slow/robotic-opener root cause. Keep in sync with app/vapi_assistant.
DEFAULT_FIRST_MESSAGE = (
    "Hi, thanks for taking the time. Whenever you're ready, just tell me a little "
    "about what you do day to day."
)
VOICES = [
    ("Nexus Interviewer (F)", RYAN_VOICE),  # F slot — speaks the global default (A20)
    ("Nexus Interviewer (M)", RYAN_VOICE),  # M slot — speaks the global default (A20)
]


def _public_url() -> str:
    return (os.environ.get("VOICE_PUBLIC_URL") or os.environ.get("APP_BASE_URL")
            or DEFAULT_PUBLIC_URL).rstrip("/")


def _assistant_config(name: str, voice: dict, base_url: str, secret: str) -> dict:
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
        # First turn (A20): canned static opener — speaks instantly, no LLM round-trip.
        "firstMessageMode": "assistant-speaks-first",
        "firstMessage": DEFAULT_FIRST_MESSAGE,
        # (1) VERBATIM — hedges are data; smart-formatting destroys the product.
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "smartFormat": False,
            "language": "en",
        },
        # (2) TURN-TAKING (A20 humanizing block) — snappy 0.4s + livekit smart endpointing;
        # semantic turn detection covers the thinking-silence case the old 2.5s wait was for.
        "startSpeakingPlan": {
            "waitSeconds": 0.4,
            "smartEndpointingPlan": {"provider": "livekit"},
        },
        # (6) INTERRUPTION — yield instantly on any speech; never talk over the respondent.
        "stopSpeakingPlan": {"numWords": 0, "voiceSeconds": 0.2, "backoffSeconds": 1.0},
        # (7) SILENCE — long; the gentle check-in is the persona's job, not an auto hang-up.
        "silenceTimeoutSeconds": 30,
        "maxDurationSeconds": 3600,
        "voice": voice,
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
    for name, voice in VOICES:
        cfg = _assistant_config(name, voice, base_url, secret)
        label = f"{voice['provider']}/{voice['voiceId']}"
        if name in by_name:
            res = _req("PATCH", f"/assistant/{by_name[name]}", key, cfg)
            print(f"  updated {name}: id={res.get('id')} voice={label}")
        else:
            res = _req("POST", "/assistant", key, cfg)
            print(f"  created {name}: id={res.get('id')} voice={label}")


if __name__ == "__main__":
    sys.exit(main())
