"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, AlertTriangle, Mic, Info, Play, Pause } from "lucide-react";
import { save_voice_config, type VoiceConfig, type VoiceOption } from "@/lib/live";

// In-app Voice Settings (Sprint-2 Lane B / #39). An admin tunes the interview voice for
// this workspace WITHOUT the VAPI dashboard. The private VAPI key never reaches here — the
// backend does the server-side push; this form only ever sees config + an honest sync
// status. Preview is a REAL voice sample (Deepgram's public clip per voice), so "listen"
// plays the actual timbre — not the workspace opener, and honestly labeled as a voice
// sample rather than a call rehearsal.
export function VoiceSettings({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: VoiceConfig;
}) {
  const [voiceId, setVoiceId] = useState(initial.voice_id);
  const [speed, setSpeed] = useState(initial.speed);
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

      {/* Speed */}
      <Section title="Speaking pace" hint="Slower can feel calmer; most interviews sit near normal">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-sunken accent-accent"
          />
          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-ink-soft">
            {speed.toFixed(2)}×
          </span>
        </div>
      </Section>

      {/* First message */}
      <Section title="Opening line" hint="Leave empty to let the interviewer open naturally">
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={2}
          placeholder="Hi, thanks for making the time. Whenever you are ready, we can start."
          className="input resize-none"
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          When empty, the interviewer writes its own opener for each conversation.
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
