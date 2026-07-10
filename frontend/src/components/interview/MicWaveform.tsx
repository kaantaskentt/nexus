"use client";

import { useEffect, useRef, useState } from "react";

// The mic waveform bar under the orb (A19 mock). REAL SIGNAL ONLY: bars render the live
// time-domain amplitude of the respondent's actual microphone via a Web Audio analyser on
// getUserMedia. The call already holds mic permission, so this is a second, read-only tap.
// If the mic can't be tapped (permission race, exotic browser), the component renders
// NOTHING — an honest absence beats a decorative fake waveform. Muted calls show the flat
// idle line (the mic is open but silent — which is exactly what's true).

const BARS = 48;

export function MicWaveform({ active, className }: { active: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let disposed = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const render = () => {
          if (disposed) return;
          const rect = canvas.getBoundingClientRect();
          const w = Math.max(1, Math.round(rect.width * dpr));
          const h = Math.max(1, Math.round(rect.height * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          ctx.clearRect(0, 0, w, h);

          analyser.getByteTimeDomainData(data);
          const step = Math.floor(data.length / BARS);
          const gap = w / BARS;
          const bw = Math.max(1.5 * dpr, gap * 0.42);
          for (let i = 0; i < BARS; i++) {
            // peak deviation from the 128 midline within this bar's slice = real amplitude
            let peak = 0;
            for (let j = i * step; j < (i + 1) * step; j++) {
              peak = Math.max(peak, Math.abs(data[j] - 128) / 128);
            }
            const amp = reduced ? Math.min(peak, 0.25) : peak;
            const bh = Math.max(1.5 * dpr, amp * h * 0.92);
            const x = i * gap + (gap - bw) / 2;
            const y = (h - bh) / 2;
            // Amber (244,168,96) — the mid stop of the --accent (#e8641b) particle ramp.
            // Canvas 2D can't read CSS vars; retune by hand if --accent moves.
            ctx.fillStyle = `rgba(244, 168, 96, ${0.35 + amp * 0.6})`;
            ctx.beginPath();
            ctx.roundRect(x, y, bw, bh, bw / 2);
            ctx.fill();
          }
          raf = requestAnimationFrame(render);
        };
        render();
      } catch {
        if (!disposed) setAvailable(false); // honest absence, no fake bars
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => undefined);
    };
  }, [active]);

  if (!active || !available) return null;
  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
