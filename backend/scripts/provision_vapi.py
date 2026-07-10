"""Provision (or update) the Nexus voice assistants on VAPI.

Sources: docs/voice-config.md (the settings that matter and why) · MERGE_PLAN Phase 5 / A5.

VAPI is pure transport (A5): every word of interview logic stays in our turn engine.
This script only registers assistants whose brain is our custom-LLM endpoint and whose
verbatim record comes from transcript webhooks. It is idempotent — assistants are keyed
by name, updated in place if they already exist, so re-running never duplicates.

Two shared assistants are created on the A20 recipe (turbo v2.5, canned fast opener,
humanizing turn-taking block): (M) speaks "ryan" — the global default Kaan cast — and
(F) speaks "sarah" (casting-A), so a female-gendered fallback is actually female. Re-running
this script preserves, never reverts, the live pair.

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
# with the exact casting-winner settings. The F slot carries "sarah" (casting-A, same
# engine/settings) so a female-gendered fallback is actually female (watchtower correction,
# July 7). Keep in sync with app/vapi_assistant.voice_block.
def _elevenlabs_voice(voice_id: str) -> dict:
    return {
        "provider": "11labs",
        "voiceId": voice_id,
        "model": "eleven_turbo_v2_5",
        "stability": 0.45,
        "similarityBoost": 0.75,
        "style": 0.0,
        "useSpeakerBoost": True,
        "optimizeStreamingLatency": 3,
        # Brisk-but-complete opener (Kaan verdict 3, July 7): VAPI has no per-message TTS
        # rate, so the full call runs slightly raised. 1.07 is inside ElevenLabs' natural
        # band; the opener keeps its full transparency arc, just delivered faster.
        "speed": 1.07,
    }
# The canned fast opener (A20) — static text speaks instantly; the model-generated mode
# was the slow/robotic-opener root cause. Carries the persona's full opening arc
# (stage7-interviewer.md Opening moves 1-3). EMRE-SEAM: wording is Emre's to refine.
# Keep in sync with app/vapi_assistant.DEFAULT_FIRST_MESSAGE. Brand stays config: the
# product name is read from config/brand.json (this script keeps no app imports).
def _product_name() -> str:
    import pathlib
    try:
        cfg = pathlib.Path(__file__).resolve().parents[2] / "config" / "brand.json"
        return json.loads(cfg.read_text()).get("product_name", "Nexus")
    except OSError:
        return "Nexus"


DEFAULT_FIRST_MESSAGE = (
    f"Hi, I'm {_product_name()}. Thanks so much for making the time. I'm here to understand how "
    "your work actually happens, day to day, the real version, not the tidy one. "
    "There are no right answers, and nothing here is a test. One quick note before we "
    "start: I'll turn our conversation into a short summary of how the work flows, and "
    "nothing gets quoted back with your name on it, your answers get combined with "
    "everyone else's before anyone sees conclusions. And I don't ask you to judge anyone. If an "
    "opinion about a person comes up, I keep it out of what I share unless you tell me "
    "to include it. We'll take about thirty minutes, and you can pause anytime. Ready "
    "when you are. So, to start: what do you actually do here? How would you describe "
    "your job to someone new?"
)
VOICES = [
    ("Nexus Interviewer (F)", _elevenlabs_voice("sarah")),  # F slot — casting-A female
    ("Nexus Interviewer (M)", _elevenlabs_voice("ryan")),   # M slot — the global default (A20)
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
        "stopSpeakingPlan": {"numWords": 2, "voiceSeconds": 0.4, "backoffSeconds": 1.0},
        # (7) SILENCE — long; the gentle check-in is the persona's job, not an auto hang-up.
        # 60s (was 30): 30 cut real calls short when a respondent paused to think
        # (SIMPLIFY-EF-FINDINGS.md F). Keep in sync with app/vapi_assistant.py.
        "silenceTimeoutSeconds": 60,
        "maxDurationSeconds": 3600,
        "voice": voice,
        # (4) RECORDING + WEBHOOKS — raw audio + verbatim transcript are evidence.
        "artifactPlan": {"recordingEnabled": True, "videoRecordingEnabled": False},
        "server": {"url": f"{base_url}/api/voice/webhook", "headers": auth},
        "serverMessages": ["transcript", "end-of-call-report", "status-update"],
        # The browser SDK only receives events named in clientMessages; without this the
        # LiveRoom got ZERO transcript events and the on-screen transcript froze on the
        # opener while the DB filled from serverMessages (ADDENDUM 3.1 P1, broke at the
        # July 9 re-provision 16a2614). Keep in sync with app/vapi_assistant.py.
        "clientMessages": ["transcript", "status-update", "speech-update"],
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
    if not secret and "--allow-no-secret" not in sys.argv:
        # Refuse, don't warn (July 7 near-miss): a PATCH without the secret STRIPS the
        # Authorization headers off live assistants while prod still requires them —
        # every voice turn then 401s. Pull the real value from Railway before running.
        raise SystemExit(
            "VOICE_SHARED_SECRET empty — this would strip auth from live assistants. "
            "Set it (railway variables --service nexus-api --kv | grep VOICE_SHARED_SECRET) "
            "or pass --allow-no-secret if the backend really runs open."
        )

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
