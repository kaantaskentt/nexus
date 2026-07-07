"""VAPI assistant config — the single shape a Nexus interview assistant takes, plus the
voice library and the shared-default assistant ids.

Sources: docs/voice-config.md (every setting and why) · scripts/provision_vapi.py (the
sibling that registers the two shared defaults; it keeps its own inline copy so a one-off
provisioning run has no app import). This module is what the per-workspace voice-config
router (routers/voice_config.py) builds a DEDICATED assistant from — same brain, same
transport, only the voice/opener differ. VAPI stays pure transport: the interview logic
never lives here, only the knobs an admin is allowed to turn.

The default assistant ids are the two globally-provisioned assistants (asteria F / orion M);
they are env-overridable so a different VAPI account can point at its own pair without a
code change (mirrors provision_vapi's URL resolution)."""

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

# Warm-professional Deepgram Aura-2 voices (built into VAPI — no extra provider key). Gender
# tags let the editor filter M/F; the note is the one-line character shown in the picker.
# asteria/orion are the shared defaults, listed first in each gender. Every voice here has a
# verified public Deepgram sample (preview_url below), so the editor can offer preview-listen
# — voices whose Aura-2 sample 404s (stella/perseus/angus) are deliberately not listed.
_SAMPLE = "https://static.deepgram.com/examples/Aura-2-{voice}.wav"
VOICE_LIBRARY = [
    {"voice_id": "asteria",   "label": "Asteria",   "gender": "F", "note": "Warm and friendly (default)"},
    {"voice_id": "luna",      "label": "Luna",      "gender": "F", "note": "Soft and calm"},
    {"voice_id": "athena",    "label": "Athena",    "gender": "F", "note": "Composed and steady"},
    {"voice_id": "hera",      "label": "Hera",      "gender": "F", "note": "Measured and mature"},
    {"voice_id": "thalia",    "label": "Thalia",    "gender": "F", "note": "Bright and easygoing"},
    {"voice_id": "orion",     "label": "Orion",     "gender": "M", "note": "Approachable and warm (default)"},
    {"voice_id": "arcas",     "label": "Arcas",     "gender": "M", "note": "Natural and easy"},
    {"voice_id": "apollo",    "label": "Apollo",    "gender": "M", "note": "Confident and clear"},
    {"voice_id": "orpheus",   "label": "Orpheus",   "gender": "M", "note": "Rounded and calm"},
    {"voice_id": "zeus",      "label": "Zeus",      "gender": "M", "note": "Deep and steady"},
]
# A preview sample per voice, for the admin to listen before choosing (task #39).
for _v in VOICE_LIBRARY:
    _v["preview_url"] = _SAMPLE.format(voice=_v["voice_id"])

VOICE_IDS = {v["voice_id"] for v in VOICE_LIBRARY}
GENDER_FOR_VOICE = {v["voice_id"]: v["gender"] for v in VOICE_LIBRARY}


def voice_block(voice_id: str, speed: float) -> dict:
    """The VAPI `voice` object. speed is carried for providers that honor variable rate;
    Deepgram Aura runs at a fixed rate, so a non-default speed is only sent (never forced)
    and the honest sync status shows whether VAPI accepted it."""
    block = {"provider": "deepgram", "voiceId": voice_id}
    if speed and abs(float(speed) - 1.0) > 1e-6:
        block["speed"] = float(speed)
    return block


def first_message_block(first_message: str | None) -> dict:
    """Empty => the model generates the opener (turn engine owns the script, the default).
    Set => a static admin-authored opener the assistant speaks first."""
    if first_message and first_message.strip():
        return {
            "firstMessageMode": "assistant-speaks-first",
            "firstMessage": first_message.strip(),
        }
    return {
        "firstMessageMode": "assistant-speaks-first-with-model-generated-message",
        "firstMessage": "",
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
        # PATIENT ENDPOINTING — episodic recall needs thinking silence.
        "startSpeakingPlan": {"waitSeconds": 2.5, "smartEndpointingPlan": {"provider": "livekit"}},
        # INTERRUPTION — yield immediately; never talk over the respondent.
        "stopSpeakingPlan": {"numWords": 1, "voiceSeconds": 0.2, "backoffSeconds": 1.0},
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
