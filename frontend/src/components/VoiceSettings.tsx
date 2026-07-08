"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, AlertTriangle, Mic, Info, Play, Pause } from "lucide-react";
import { save_voice_config, type VoiceConfig, type VoiceOption } from "@/lib/live";

// In-app Voice Settings (Sprint-2 Lane B / #39). An admin tunes the interview voice for
// this workspace WITHOUT the VAPI dashboard. The private VAPI key never reaches here — the
// backend does the server-side push; this form only ever sees config + an honest sync
// status. Preview is a REAL voice sample when one exists (Deepgram publishes a public clip
// per voice); the ElevenLabs voices (A20 — ryan is the global default) have no public clip,
// so their cards carry no play button rather than a fake one.
export function VoiceSettings({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: VoiceConfig;
}) {
  const [voiceId, setVoiceId] = useState(initial.voice_id);
  // speed is stored but not user-editable yet: the current Deepgram Aura voices have no
  // speed control, so we don't render a slider that does nothing (every-button-works). We
  // pass the stored value straight through; a real control returns with speed-capable voices.
  const [speed] = useState(initial.speed);
  const [firstMessage, setFirstMessage] = useState(initial.first_message ?? "");
  const [gender, setGender] = useState<"F" | "M">(initial.gender);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<VoiceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tear down any sample playback on unmount.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const voicesForGender = useMemo(
    () => initial.voices.filter((v) => v.gender === gender),
    [initial.voices, gender],
  );

  const current = saved ?? initial;
  const dirty =
    voiceId !== current.voice_id ||
    speed !== current.speed ||
    (firstMessage.trim() || null) !== (current.first_message ?? null);

  function pickGender(g: "F" | "M") {
    setGender(g);
    // Keep a valid voice for the gender — snap to the first if the current one is filtered out.
    if (!initial.voices.some((v) => v.voice_id === voiceId && v.gender === g)) {
      const first = initial.voices.find((v) => v.gender === g);
      if (first) setVoiceId(first.voice_id);
    }
  }

  function togglePreview(v: VoiceOption) {
    if (!v.preview_url) return; // no clip exists — the card renders no play button
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    if (playing === v.voice_id) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.pause();
    audio.src = v.preview_url;
    audio.onended = () => setPlaying(null);
    audio.play().then(() => setPlaying(v.voice_id)).catch(() => setPlaying(null));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await save_voice_config(workspaceId, {
        voice_id: voiceId,
        speed,
        first_message: firstMessage.trim() || null,
      });
      setSaved(res);
    } catch {
      setError("Could not save the voice settings. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
            <Mic className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">Interview voice</h1>
            <p className="text-sm text-ink-soft">
              How the interviewer sounds when someone joins by voice.
            </p>
          </div>
        </div>
      </header>

      <StatusBanner config={saved ?? initial} justSaved={!!saved} />

      {/* Voice: gender toggle + a card per available voice, each with a sample preview */}
      <Section title="Voice" hint="Warm, professional voices built for interviews">
        <div className="mb-4 inline-flex rounded-lg border border-line bg-surface-sunken p-1">
          {(["F", "M"] as const).map((g) => (
            <button
              key={g}
              onClick={() => pickGender(g)}
              className={
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
                (gender === g
                  ? "bg-surface text-ink shadow-elev-1"
                  : "text-ink-soft hover:text-ink")
              }
            >
              {g === "F" ? "Female" : "Male"}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {voicesForGender.map((v) => {
            const active = v.voice_id === voiceId;
            const isPlaying = playing === v.voice_id;
            return (
              <div
                key={v.voice_id}
                className={
                  "lift relative flex items-center gap-3 rounded-card border px-4 py-3 " +
                  (active
                    ? "border-accent bg-accent-soft/50"
                    : "border-line bg-surface hover:border-line-strong")
                }
              >
                {/* Selection covers the card; the preview button sits above it (z-10). */}
                <button
                  onClick={() => setVoiceId(v.voice_id)}
                  aria-label={`Use ${v.label}`}
                  aria-pressed={active}
                  className="absolute inset-0 rounded-card"
                />
                {v.preview_url ? (
                  <button
                    onClick={() => togglePreview(v)}
                    aria-label={isPlaying ? `Stop ${v.label} sample` : `Play ${v.label} sample`}
                    className={
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors " +
                      (isPlaying
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line-strong text-ink-soft hover:border-accent hover:text-accent")
                    }
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <Play className="h-4 w-4 translate-x-px" strokeWidth={2} />
                    )}
                  </button>
                ) : (
                  // No public sample clip exists for this voice — an honest static badge,
                  // never a play button that does nothing. Clicks pass through to select.
                  <div
                    className="pointer-events-none relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint"
                    title="No sample clip for this voice yet"
                  >
                    <Mic className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                )}
                <div className="relative z-10 min-w-0 pointer-events-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">{v.label}</span>
                    {active && <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />}
                  </div>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">{v.note}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Speaking pace — still no slider: the ElevenLabs voices can vary speed server-side,
          but a pace control is an A19 taste decision; until it ships we say so plainly
          rather than render a dead knob (every-button-works). */}
      <Section title="Speaking pace" hint="How quickly the interviewer speaks">
        <p className="rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-soft">
          These voices speak at a natural, even pace suited to interviews. A pace control
          isn&apos;t part of settings yet.
        </p>
      </Section>

      {/* First message — the placeholder IS the standard opener (A20 canned arc: greeting,
          why this conversation exists, the sharing-rules promise, then the invitation), so
          what the admin sees greyed out is exactly what plays when they leave this empty.
          EMRE-SEAM: the standard wording is Emre's to refine (backend DEFAULT_FIRST_MESSAGE). */}
      <Section title="Opening line" hint="Leave empty to use the standard opener">
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={5}
          placeholder="Hi, I'm Nexus. Thanks so much for making the time. I'm here to understand how your work actually happens, day to day, the real version, not the tidy one. There are no right answers, and nothing here is a test. One quick note before we start: I'll turn our conversation into a short summary of how the work flows, and nothing gets quoted back with your name on it, your answers get combined with everyone else's before anyone sees conclusions. And I don't ask you to judge anyone. If an opinion about a person comes up, I keep it out of what I share unless you tell me to include it. We'll take about thirty minutes, and you can pause anytime. Ready when you are. Could you start by walking me through what a normal day looks like for you, from the very beginning?"
          className="input resize-none"
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          When empty, the interviewer opens with the standard greeting above, spoken the
          moment the call connects: who it is, why this conversation exists, how sharing
          works, then the first question.
        </p>
      </Section>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Saving
            </>
          ) : (
            <>Save voice</>
          )}
        </button>
        {!dirty && saved && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft"
          >
            <Check className="h-4 w-4 text-tag-verified" strokeWidth={2.5} /> Saved
          </motion.span>
        )}
      </div>
    </div>
  );
}

// Honest state: is the change actually live on calls, saved-but-pending, or is voice not
// even connected on this server? Never claims "live" when it isn't.
function StatusBanner({ config, justSaved }: { config: VoiceConfig; justSaved: boolean }) {
  if (!config.vapi_configured) {
    return (
      <Banner tone="muted">
        Voice is not connected on this server yet, so changes are saved but will not affect
        live calls until it is. Your selection is kept and applied once voice is connected.
      </Banner>
    );
  }
  if (config.sync_error) {
    return <Banner tone="warn">{config.sync_error}</Banner>;
  }
  if (justSaved && config.vapi_synced) {
    return <Banner tone="ok">Saved and live. This voice is used on the next call for this company.</Banner>;
  }
  if (config.is_custom && config.vapi_synced) {
    return <Banner tone="ok">This company uses a custom interview voice, live on new calls.</Banner>;
  }
  return (
    <Banner tone="muted">
      Using the default interview voice. Pick a voice and save to set one just for this
      company; changes take effect on the next call.
    </Banner>
  );
}

function Banner({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const styles = {
    ok: "border-success/25 bg-success-soft text-tag-verified",
    warn: "border-accent/30 bg-accent-soft text-accent-ink",
    muted: "border-line bg-surface-sunken text-ink-soft",
  }[tone];
  return (
    <div className={"mb-8 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm " + styles}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
