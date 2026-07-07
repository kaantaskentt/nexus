# VOICE-RESEARCH.md — casting-call recipes + humanizing config (task #41)

Source of truth: VAPI OpenAPI schema `https://docs.vapi.ai/api-reference/assistants/create.md`
(pulled + grepped raw, July 6 evening) and `https://docs.vapi.ai/customization/speech-configuration`.
Provider access CONFIRMED live on our key by team-lead: `11labs`, `cartesia`, `rime-ai` all
create+delete 200. This doc hands voice-settings a copy-paste assistant config block per
recipe, plus the opener-velocity fix (owned here) that goes in ALL four.

Kaan's complaint that triggered this: his test call felt **robotic and slow, especially the
opener**. The two root causes and their fixes are in section 2 and 3 — the opener one is the
big win.

---

## 1. Provider picture (latency vs naturalness)

| Provider | Model to use | Latency | Naturalness / warmth | Use in |
|---|---|---|---|---|
| ElevenLabs | `eleven_turbo_v2_5` | low (~250-300ms) | highest warmth, most human prosody | A, B |
| Cartesia | `sonic-2` (or `sonic-3`) | lowest class (~90ms) | fast + natural, a touch cooler than 11labs | C |
| Deepgram Aura | current `aura` voice | low | our existing baseline | D (control) |
| ElevenLabs | `eleven_flash_v2_5` | lowest (~75ms) | slightly flatter than turbo, very fast | 5th (future) |
| Rime | `arcana` / `mist` | low | characterful, less "neutral pro" | wildcard (not in the 4) |

Read: the 4 casting links Kaan calls are A = ElevenLabs turbo warm female, B = ElevenLabs turbo
warm male, C = Cartesia Sonic, D = current Deepgram Aura + the SAME timing/opener fixes as a
CONTROL. D-as-control (per Kaan's spec) isolates the tier-upgrade (voice provider) from the
timing-fix: every recipe gets the opener + humanizing block, so what Kaan's ear is comparing is
purely the voice. The ElevenLabs Flash speed test is a good idea but it is a FUTURE 5th
comparison (see §6), not one of tonight's 4.

---

## 2. The opener-velocity fix (owned here — goes in ALL 4 recipes)

**Root cause of the slow/robotic opener:** the assistant was almost certainly on
`firstMessageMode: "assistant-speaks-first-with-model-generated-message"`. That mode makes the
LLM GENERATE the opening line live at call start, adding a full model round-trip of latency
before the first word AND producing stiffer, generic phrasing.

**Fix:** `firstMessageMode: "assistant-speaks-first"` with a **static, canned `firstMessage`**.
The confirmed enum (VAPI `firstMessageMode`) is exactly three values:
- `assistant-speaks-first` — speaks the static `firstMessage` immediately. **USE THIS.** TTS
  starts streaming a known string at once; no LLM wait.
- `assistant-speaks-first-with-model-generated-message` — the slow/robotic one. Avoid.
- `assistant-waits-for-user` — silent open; wrong for a warm interviewer.

**Canned opener copy (domain-neutral per non-negotiable #8; no em-dashes; warm + human):**

> "Hi, thanks so much for making the time. This is really just a relaxed conversation about
> how your work actually goes. There are no right answers and nothing to prep. Whenever you
> feel ready, maybe start by telling me a little about what a normal day looks like for you."

This is a single fixed string, so it is spoken instantly and identically every call. Industry
context stays runtime-injected into the system prompt, never baked into this opener.

---

## 3. Shared humanizing config (goes in ALL 4 recipes)

Confirmed field names + defaults from the schema:

```jsonc
{
  "firstMessageMode": "assistant-speaks-first",
  "firstMessage": "<the canned opener from section 2>",

  // Turn-taking feel. waitSeconds default is 0.4 (confirmed @default 0.4).
  // Keep 0.4 for an interviewer: snappy but lets a person finish a thought.
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingPlan": { "provider": "livekit" }   // livekit = best English turn-detection
  },

  // Let the respondent interrupt instantly (they are the one we want talking).
  "stopSpeakingPlan": {
    "numWords": 0,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1
  },

  "backgroundSound": "off"   // fewer false-endpointing triggers = snappier feel
}
```

**Backchanneling — HONEST FINDING:** VAPI has **no `backchannelingEnabled` toggle** in the
current CreateAssistantDTO. The only "backchanneling" in the schema is the acknowledgement-
phrases list inside `stopSpeakingPlan`, which is about interruption handling, not the assistant
saying "mm-hm". So interviewer backchanneling (light "mm-hm", "right", "I see" while the person
talks) must be a **system-prompt instruction**, not a config field. Recommend adding one line to
the interviewer prompt: *"Use short, warm acknowledgements (mm-hm, right, I see) to show you're
listening, but never interrupt a thought."* Flagging so nobody hunts for a field that isn't there.

---

## 4. The four recipes (copy-paste voice blocks for voice-settings)

All four take sections 2 + 3 verbatim. Only the `voice` block differs.

**Recipe A — ElevenLabs warm female (the default warmth benchmark)**
```jsonc
"voice": {
  "provider": "11labs",
  "voiceId": "sarah",            // VAPI built-in preset — soft, warm; no library setup needed
  "model": "eleven_turbo_v2_5",
  "stability": 0.45,             // lower = more expressive/less monotone
  "similarityBoost": 0.75,
  "style": 0.0,                  // 0 = natural, no exaggeration
  "useSpeakerBoost": true,
  "optimizeStreamingLatency": 3, // 0-4; 3 balances speed vs quality
  "speed": 1.0
}
```

**Recipe B — ElevenLabs warm male**
```jsonc
"voice": {
  "provider": "11labs",
  "voiceId": "ryan",             // preset; warm, conversational male (alt: "joseph")
  "model": "eleven_turbo_v2_5",
  "stability": 0.45, "similarityBoost": 0.75, "style": 0.0,
  "useSpeakerBoost": true, "optimizeStreamingLatency": 3, "speed": 1.0
}
```

**Recipe C — Cartesia Sonic (fast + natural challenger, female)**
```jsonc
"voice": {
  "provider": "cartesia",
  "voiceId": "<pick a warm conversational female from the Cartesia library>",
  "model": "sonic-2"             // or "sonic-3" (latest); both low-latency
}
```
Note: Cartesia voiceIds are library UUIDs, not preset names — voice-settings picks a warm
conversational voice in the Cartesia dashboard. Aim for "warm / friendly / conversational",
not "narration".

**Recipe D — Deepgram Aura CONTROL (Kaan's spec)**
```jsonc
"voice": {
  "provider": "deepgram",
  "voiceId": "aura-2-thalia-en"   // or keep the workspace's CURRENT asteria voice as-is
}
```
D is the baseline: our current Deepgram Aura voice, but WITH the same opener fix + humanizing
block (§2, §3) as the others. That is deliberate — it isolates the ONE variable Kaan is judging
(voice provider / tier upgrade) from the timing/opener fix, which every recipe gets. So A/B/C vs
D answers "does the premium voice tier beat our current voice, once timing is equal?"

ElevenLabs preset voiceIds available out of the box (no library upload):
`burt, marissa, andrea, sarah, phillip, steve, joseph, myra, paula, ryan, drew, paul, mrb,
matilda, mark`. Warm female: sarah, matilda, paula, andrea. Warm male: ryan, joseph, drew, paul.

---

## 5. Recommendation

Ship A/B/C/D as above. The opener fix (section 2) is the single biggest perceived-quality lever
and is provider-independent, so it lands in all four regardless of which voice Kaan picks. My
pick for the eventual default: **Recipe A (ElevenLabs sarah, turbo v2.5)** for warmth, with C
(Cartesia) as the fallback if latency ever matters more than the last 10% of warmth.

---

## 6. Future 5th comparison (not tonight's 4) — ElevenLabs Flash

Once Kaan has picked a voice tier from A/B/C/D, a worthwhile follow-up is a Flash-vs-Turbo A/B
on the WINNING ElevenLabs voice: same voiceId, `model: "eleven_flash_v2_5"`,
`optimizeStreamingLatency: 4`. Flash is the lowest-latency 11labs model (~75ms) but slightly
flatter in prosody. This isolates one variable — turbo vs flash — to answer "is the snappier
latency worth the small warmth cost for an interviewer?" Kept here so the idea is not lost; it
is deliberately NOT one of the 4 casting links (those follow Kaan's A/B/C/D spec).
