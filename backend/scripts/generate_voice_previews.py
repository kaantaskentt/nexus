"""Generate our OWN voice preview clips for the Voice Settings roster (Kaan, July 7).

The stock provider samples spoke someone else's company name ("welcome to ClearPath
Solutions") — banned. Each roster voice gets a one-line clip in the product's actual
register (the real opener's first beat, product name from config/brand.json), cached as
static audio under frontend/public/voice-previews/ and recorded in app/voice_previews.json
(the manifest the roster reads). Re-run after any roster change; existing clips regenerate.

Providers:
  - deepgram (Aura-2): needs DEEPGRAM_API_KEY.
  - 11labs: needs ELEVENLABS_API_KEY + a real ElevenLabs voice UUID per VAPI preset alias
    in ELEVEN_VOICE_IDS below (VAPI's "ryan"/"sarah" are aliases, not ElevenLabs IDs).

Honest fallback: a voice this script cannot generate for (missing key or unmapped alias)
is SKIPPED — it simply stays "Preview unavailable" in the editor. Never substitute stock
audio.

Usage:  python backend/scripts/generate_voice_previews.py
"""

import json
import os
import pathlib
import sys
import urllib.request

REPO = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "frontend" / "public" / "voice-previews"
MANIFEST = REPO / "backend" / "app" / "voice_previews.json"

# Fill with real ElevenLabs voice UUIDs when the direct key lands; VAPI preset aliases
# do not resolve on the ElevenLabs API.
ELEVEN_VOICE_IDS: dict[str, str] = {}


def _brand_name() -> str:
    try:
        return json.loads((REPO / "config" / "brand.json").read_text()).get("product_name", "Nexus")
    except OSError:
        return "Nexus"


def preview_line() -> str:
    name = _brand_name()
    return (
        f"Hi, I'm {name}. I'm here to understand how your work actually happens, "
        "the real version, not the tidy one."
    )


def _deepgram(voice_id: str, text: str, key: str) -> bytes:
    req = urllib.request.Request(
        f"https://api.deepgram.com/v1/speak?model=aura-2-{voice_id}-en",
        data=json.dumps({"text": text}).encode(),
        headers={"Authorization": f"Token {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _elevenlabs(voice_id: str, text: str, key: str) -> bytes:
    real = ELEVEN_VOICE_IDS.get(voice_id)
    if not real:
        raise LookupError(f"no ElevenLabs UUID mapped for preset alias {voice_id!r}")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{real}?output_format=mp3_44100_128",
        data=json.dumps({
            "text": text, "model_id": "eleven_turbo_v2_5",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
        }).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> None:
    sys.path.insert(0, str(REPO / "backend"))
    from app.vapi_assistant import VOICE_LIBRARY

    text = preview_line()
    dg_key = os.environ.get("DEEPGRAM_API_KEY", "")
    el_key = os.environ.get("ELEVENLABS_API_KEY", "")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}
    skipped = []

    for v in VOICE_LIBRARY:
        key = f"{v['provider']}:{v['voice_id']}"
        try:
            if v["provider"] == "deepgram":
                if not dg_key:
                    raise LookupError("DEEPGRAM_API_KEY not set")
                audio, ext = _deepgram(v["voice_id"], text, dg_key), "mp3"
            elif v["provider"] == "11labs":
                if not el_key:
                    raise LookupError("ELEVENLABS_API_KEY not set")
                audio, ext = _elevenlabs(v["voice_id"], text, el_key), "mp3"
            else:
                raise LookupError(f"unknown provider {v['provider']}")
        except Exception as e:  # skip = honest "Preview unavailable", never stock audio
            skipped.append((key, str(e)))
            continue
        fname = f"{v['provider']}-{v['voice_id']}.{ext}"
        (OUT_DIR / fname).write_bytes(audio)
        manifest[key] = f"/voice-previews/{fname}"
        print(f"  generated {fname} ({len(audio)} bytes)")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"manifest: {MANIFEST} ({len(manifest)} clips)")
    for key, why in skipped:
        print(f"  skipped {key}: {why} -> stays 'Preview unavailable'")


if __name__ == "__main__":
    main()
