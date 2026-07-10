"""VAPI assistant config — the single shape a Nexus interview assistant takes, plus the
voice library and the shared-default assistant ids.

Sources: docs/voice-config.md (every setting and why) · scripts/provision_vapi.py (the
sibling that registers the two shared defaults; it keeps its own inline copy so a one-off
provisioning run has no app import). This module is what the per-workspace voice-config
router (routers/voice_config.py) builds a DEDICATED assistant from — same brain, same
transport, only the voice/opener differ. VAPI stays pure transport: the interview logic
never lives here, only the knobs an admin is allowed to turn.

The default assistant ids are the two globally-provisioned shared assistants, both on the
A20 ElevenLabs recipe with the canned fast opener: (M) speaks "ryan" — the global default
Kaan cast — and (F) speaks "sarah" (casting-A), so a gender-tagged workspace config that
never synced falls back to a voice of the right gender. Ids are env-overridable so a
different VAPI account can point at its own pair without a code change."""

import json
import os
from pathlib import Path

VAPI_BASE = "https://api.vapi.ai"

# api.vapi.ai sits behind Cloudflare, which 403s (error 1010) a default client signature;
# a normal browser User-Agent clears it. Same trick provision_vapi.py uses.
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# The two shared assistants every workspace falls back to until it customizes. These ids
# are the ones provision_vapi.py created and VoiceCall.tsx starts by default; centralized
# here (env-overridable) so the resolver and the frontend agree on one source of truth.
DEFAULT_ASSISTANT_IDS = {
    "F": os.environ.get("VAPI_ASSISTANT_F", "44d14d38-6de6-4079-aee0-b2bde53eaad3"),
    "M": os.environ.get("VAPI_ASSISTANT_M", "0853702b-cb75-4609-8af0-d15653dcbbae"),
}

# The voice roster spans two providers (A20). ElevenLabs turbo v2.5 presets are the premium
# tier Kaan picked in the July 7 casting call — "ryan" is the global default. The Deepgram
# Aura-2 voices (built into VAPI, no extra key) remain as options. Gender tags let the editor
# filter M/F; the note is the one-line character shown in the picker.
# PREVIEWS (task #27, Kaan July 8 — supersedes the July 7 all-or-nothing veto): a
# three-tier chain, each tier honest about what it is.
#   1. OWN clip from the manifest (scripts/generate_voice_previews.py: real opener line,
#      our brand, per-provider TTS — needs ELEVENLABS/DEEPGRAM keys). Wins automatically
#      the moment the manifest lands, so generating clips IS the swap.
#   2. PROVIDER sample (Deepgram's hosted Aura-2 demos, verified live July 8). These speak
#      the provider's own demo copy, so the editor labels them "Provider sample" — the
#      July 7 ClearPath objection was a stock clip PRESENTED as ours; labeled, it's just
#      the provider's voice demo.
#   3. None -> the editor's honest "Preview unavailable" badge (the ElevenLabs presets
#      have no public clip).
_PREVIEW_MANIFEST = Path(__file__).resolve().parent / "voice_previews.json"
try:
    _PREVIEWS: dict = json.loads(_PREVIEW_MANIFEST.read_text())
except (OSError, ValueError):
    _PREVIEWS = {}
ELEVENLABS_MODEL = "eleven_turbo_v2_5"
DEFAULT_VOICE_ID = "ryan"  # A20 — Kaan's casting-call verdict, the voice of Nexus
VOICE_LIBRARY = [
    {"voice_id": "sarah",     "label": "Sarah",     "provider": "11labs",   "gender": "F", "note": "Soft and warm"},
    {"voice_id": "asteria",   "label": "Asteria",   "provider": "deepgram", "gender": "F", "note": "Warm and friendly"},
    {"voice_id": "luna",      "label": "Luna",      "provider": "deepgram", "gender": "F", "note": "Soft and calm"},
    {"voice_id": "athena",    "label": "Athena",    "provider": "deepgram", "gender": "F", "note": "Composed and steady"},
    {"voice_id": "hera",      "label": "Hera",      "provider": "deepgram", "gender": "F", "note": "Measured and mature"},
    {"voice_id": "thalia",    "label": "Thalia",    "provider": "deepgram", "gender": "F", "note": "Bright and easygoing"},
    {"voice_id": "ryan",      "label": "Ryan",      "provider": "11labs",   "gender": "M", "note": "Warm and conversational (default)"},
    {"voice_id": "orion",     "label": "Orion",     "provider": "deepgram", "gender": "M", "note": "Approachable and warm"},
    {"voice_id": "arcas",     "label": "Arcas",     "provider": "deepgram", "gender": "M", "note": "Natural and easy"},
    {"voice_id": "apollo",    "label": "Apollo",    "provider": "deepgram", "gender": "M", "note": "Confident and clear"},
    {"voice_id": "orpheus",   "label": "Orpheus",   "provider": "deepgram", "gender": "M", "note": "Rounded and calm"},
    {"voice_id": "zeus",      "label": "Zeus",      "provider": "deepgram", "gender": "M", "note": "Deep and steady"},
]
# Resolve the preview chain per voice. preview_kind tells the editor how to label it:
# "own" (no extra copy needed), "provider" (renders the "Provider sample" microcopy),
# or None (renders "Preview unavailable").
_PROVIDER_SAMPLE = "https://static.deepgram.com/examples/Aura-2-{voice}.wav"
for _v in VOICE_LIBRARY:
    _own = _PREVIEWS.get(f"{_v['provider']}:{_v['voice_id']}")
    if _own:
        _v["preview_url"], _v["preview_kind"] = _own, "own"
    elif _v["provider"] == "deepgram":
        _v["preview_url"] = _PROVIDER_SAMPLE.format(voice=_v["voice_id"])
        _v["preview_kind"] = "provider"
    else:
        _v["preview_url"], _v["preview_kind"] = None, None

VOICE_IDS = {v["voice_id"] for v in VOICE_LIBRARY}
GENDER_FOR_VOICE = {v["voice_id"]: v["gender"] for v in VOICE_LIBRARY}
PROVIDER_FOR_VOICE = {v["voice_id"]: v["provider"] for v in VOICE_LIBRARY}


def voice_block(voice_id: str, speed: float) -> dict:
    """The VAPI `voice` object for a roster voice. ElevenLabs voices take the full A20
    recipe (turbo v2.5, stability 0.45 / similarityBoost 0.75 / speakerBoost, streaming
    latency 3 — the exact casting-winner settings) and honor `speed` natively. Deepgram
    Aura runs at a fixed rate, so a non-default speed is only sent (never forced) and the
    honest sync status shows whether VAPI accepted it."""
    if PROVIDER_FOR_VOICE.get(voice_id) == "11labs":
        return {
            "provider": "11labs",
            "voiceId": voice_id,
            "model": ELEVENLABS_MODEL,
            "stability": 0.45,
            "similarityBoost": 0.75,
            "style": 0.0,
            "useSpeakerBoost": True,
            "optimizeStreamingLatency": 3,
            "speed": float(speed) if speed else 1.0,
        }
    block = {"provider": "deepgram", "voiceId": voice_id}
    if speed and abs(float(speed) - 1.0) > 1e-6:
        block["speed"] = float(speed)
    return block


# The canned fast opener (A20 / VOICE-RESEARCH §2). A static first line starts TTS the
# instant the call connects; the old model-generated mode added a full LLM round-trip of
# dead air and read stiff — the root cause of the robotic opener Kaan flagged. A canned
# message costs the same latency whether short or complete (Kaan, July 7), so it carries
# the persona's FULL opening arc from prompts/agents/stage7-interviewer.md Opening moves
# 1-3: greet + who this is and why, the sharing-rules promise (EK 3.2 — made before any
# real question, every time), the shape, then the day-to-day invitation. Domain-neutral
# (non-negotiable #8): industry context stays runtime-injected, never baked here.
# EMRE-SEAM: the exact wording is Emre's to refine — replace the text, keep the arc.
def _default_first_message() -> str:
    from .config import get_brand

    name = get_brand().get("product_name", "Nexus")
    return (
        f"Hi, I'm {name}. Thanks so much for making the time. I'm here to understand how "
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


DEFAULT_FIRST_MESSAGE = _default_first_message()


def first_message_block(first_message: str | None) -> dict:
    """Admin-authored opener when set; otherwise the canned default opener. Both speak as
    static text (assistant-speaks-first) — the model-generated mode is deliberately never
    used since A20 (it was the slow/robotic-opener root cause)."""
    text = (first_message or "").strip() or DEFAULT_FIRST_MESSAGE
    return {
        "firstMessageMode": "assistant-speaks-first",
        "firstMessage": text,
    }


def build_assistant_config(
    name: str,
    voice_id: str,
    base_url: str,
    secret: str,
    *,
    speed: float = 1.0,
    first_message: str | None = None,
) -> dict:
    """Full config for a Nexus interview assistant — identical to the shared defaults
    except voice/opener. The brain is our custom-LLM endpoint; the verbatim record comes
    from transcript webhooks (docs/voice-config.md). Auth (VOICE_SHARED_SECRET) rides the
    model + server headers so our endpoints admit VAPI's calls."""
    auth = {"Authorization": secret} if secret else {}
    return {
        "name": name,
        "model": {
            "provider": "custom-llm",
            "url": f"{base_url}/api/voice",  # VAPI POSTs <url>/chat/completions per turn
            "model": "nexus-interviewer",
            "temperature": 1.0,
            "headers": auth,
        },
        **first_message_block(first_message),
        # VERBATIM — hedges are data; smart-formatting destroys the product.
        "transcriber": {"provider": "deepgram", "model": "nova-2", "smartFormat": False, "language": "en"},
        # TURN-TAKING (A20 humanizing block) — 0.4s + livekit smart endpointing: snappy but
        # lets a person finish a thought. The old 2.5s wait read as dead air; livekit's
        # semantic turn detection covers the thinking-silence case the long wait was for.
        "startSpeakingPlan": {"waitSeconds": 0.4, "smartEndpointingPlan": {"provider": "livekit"}},
        # INTERRUPTION (Kaan tune, July 8 night): a cough or "hmm" must NOT stop the
        # agent; a real sentence-start MUST. numWords=2 makes interruption transcription-
        # based (VAPI docs: 2-3 words filters backchannel), voiceSeconds=0.4 keeps a VAD
        # floor under it. Start side untouched — opener velocity is a Kaan-won behavior.
        "stopSpeakingPlan": {"numWords": 2, "voiceSeconds": 0.4, "backoffSeconds": 1.0},
        # SILENCE — long; the gentle check-in is the persona's job, not an auto hang-up.
        # 60s (was 30): a reflective respondent recalling how the work actually flows can
        # sit quiet longer than 30s, and 30 was cutting real calls short mid-conversation
        # (SIMPLIFY-EF-FINDINGS.md F, Kaan July 9). The persona still offers a break itself.
        "silenceTimeoutSeconds": 60,
        "maxDurationSeconds": 3600,
        "voice": voice_block(voice_id, speed),
        # RECORDING + WEBHOOKS — raw audio + verbatim transcript are evidence.
        "artifactPlan": {"recordingEnabled": True, "videoRecordingEnabled": False},
        "server": {"url": f"{base_url}/api/voice/webhook", "headers": auth},
        "serverMessages": ["transcript", "end-of-call-report", "status-update"],
        # MINIMAL analysis — the Stage 4 compiler is the single extraction authority.
        "analysisPlan": {
            "summaryPlan": {"enabled": False},
            "structuredDataPlan": {"enabled": False},
            "successEvaluationPlan": {"enabled": False},
        },
    }
