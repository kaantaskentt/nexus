"""VAPI assistant config — the single shape a Nexus interview assistant takes, plus the
voice library and the shared-default assistant ids.

Sources: docs/voice-config.md (every setting and why) · scripts/provision_vapi.py (the
sibling that registers the two shared defaults; it keeps its own inline copy so a one-off
provisioning run has no app import). This module is what the per-workspace voice-config
router (routers/voice_config.py) builds a DEDICATED assistant from — same brain, same
transport, only the voice/opener differ. VAPI stays pure transport: the interview logic
never lives here, only the knobs an admin is allowed to turn.

The default assistant ids are the two globally-provisioned shared assistants. Since A20
(July 7 casting verdict) BOTH speak the global default voice — ElevenLabs "ryan", turbo
v2.5 — with the canned fast opener; the F/M split survives only as the fallback slot for
gender-tagged workspace configs that never synced. Ids are env-overridable so a different
VAPI account can point at its own pair without a code change."""

import os

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
# filter M/F; the note is the one-line character shown in the picker. Deepgram voices have a
# verified public sample (preview_url), so the editor offers preview-listen — Aura-2 voices
# whose sample 404s (stella/perseus/angus) are deliberately not listed. The ElevenLabs presets
# have NO public sample clip, so their preview_url is None and the editor renders those cards
# without a play button rather than faking one.
_SAMPLE = "https://static.deepgram.com/examples/Aura-2-{voice}.wav"
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
# A preview sample per voice, for the admin to listen before choosing (task #39). Only the
# Deepgram voices have one; None is the honest "no clip" signal the editor respects.
for _v in VOICE_LIBRARY:
    _v["preview_url"] = _SAMPLE.format(voice=_v["voice_id"]) if _v["provider"] == "deepgram" else None

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
# dead air and read stiff — the root cause of the robotic opener Kaan flagged. Domain-
# neutral (non-negotiable #8): industry context stays runtime-injected, never baked here.
DEFAULT_FIRST_MESSAGE = (
    "Hi, thanks for taking the time. Whenever you're ready, just tell me a little "
    "about what you do day to day."
)


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
        # INTERRUPTION — yield instantly on any speech; never talk over the respondent.
        "stopSpeakingPlan": {"numWords": 0, "voiceSeconds": 0.2, "backoffSeconds": 1.0},
        # SILENCE — long; the gentle check-in is the persona's job, not an auto hang-up.
        "silenceTimeoutSeconds": 30,
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
