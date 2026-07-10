"use client";

import { useEffect, useRef } from "react";

// The A19 live-interview centerpiece: a dark-panel particle sphere (MERGE_PLAN A19,
// taste-approved reference set), replacing the warm v1 glass orb. Same honesty contract
// as v1 — the motion is driven only by REAL signal:
//   - `volume` — live VAPI `volume-level` (0..1) on the respondent side; on the Observer
//     it is the real turn-activity pulse (a new stored utterance), never fabricated audio.
//   - `state`  — derived from real VAPI speech/transcript events (or session status).
// At volume 0 in a listening state the sphere only rotates and breathes (an "alive" cue);
// every swell above that is actual signal. `prefers-reduced-motion` freezes rotation and
// keeps a calm opacity breath. Canvas-2D on purpose: ~700 points is trivially cheap, and
// there is no WebGL context to lose on low-power devices.

export type OrbState = "connecting" | "listening" | "thinking" | "speaking";

// Per-state resting activity (rotation speed / shimmer) and how volume drives the swell.
const STATE_ACTIVITY: Record<OrbState, number> = {
  connecting: 0.1,
  listening: 0.25,
  thinking: 0.45,
  speaking: 0.85,
};

const PARTICLES = 700;

// Fibonacci-sphere points — even coverage, no clumped poles.
function spherePoints(n: number): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

export function ParticleOrb({
  volume,
  state,
  className,
}: {
  volume: number;
  state: OrbState;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Live values the render loop reads without restarting — refs, not React state.
  const volumeTarget = useRef(0);
  const volumeSmooth = useRef(0);
  const activityTarget = useRef(STATE_ACTIVITY.connecting);
  const activitySmooth = useRef(STATE_ACTIVITY.connecting);

  useEffect(() => {
    volumeTarget.current = Math.max(0, Math.min(1, volume));
  }, [volume]);
  useEffect(() => {
    activityTarget.current = STATE_ACTIVITY[state];
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const pts = spherePoints(PARTICLES);
    // Per-particle phase for independent shimmer.
    const phase = pts.map((_, i) => (i * 2.399) % (Math.PI * 2));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let disposed = false;
    const start = performance.now();

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

      const t = (performance.now() - start) / 1000;
      volumeSmooth.current += (volumeTarget.current - volumeSmooth.current) * 0.18;
      activitySmooth.current += (activityTarget.current - activitySmooth.current) * 0.06;
      const v = volumeSmooth.current;
      const a = activitySmooth.current;

      const cx = w / 2;
      const cy = h / 2;
      const breath = reduced ? 0.5 : Math.sin(t * 0.8) * 0.5 + 0.5;
      const R = Math.min(w, h) * (0.34 + breath * 0.008 + v * 0.05);

      // Rotation: slow at rest, livelier with state activity. Frozen when reduced.
      const rotY = reduced ? 0.6 : t * (0.12 + a * 0.35);
      const rotX = reduced ? -0.35 : Math.sin(t * 0.07) * 0.35;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Soft core glow behind the particles so the sphere reads as a body, not dust.
      // Warm particle ramp is anchored on --accent (#e8641b = rgb(232,100,27)); the
      // lighter stops (250,204,140 / 255,231,200 / 244,168,96) and the ember (196,92,32)
      // are its amber neighbours. Canvas 2D can't read CSS vars — if --accent moves,
      // retune these by hand.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      glow.addColorStop(0, `rgba(250, 204, 140, ${0.10 + v * 0.16 + a * 0.04})`);
      glow.addColorStop(0.55, `rgba(232, 100, 27, ${0.05 + v * 0.08})`);
      glow.addColorStop(1, "rgba(232, 100, 27, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < pts.length; i++) {
        const [px, py, pz] = pts[i];
        // rotate around Y then X
        const x1 = px * cosY + pz * sinY;
        const z1 = -px * sinY + pz * cosY;
        const y1 = py * cosX - z1 * sinX;
        const z2 = py * sinX + z1 * cosX;

        // Volume swells the radius; a light per-particle shimmer rides the activity.
        const shimmer = reduced ? 0 : Math.sin(t * (1.2 + a * 2.4) + phase[i]) * 0.015 * (0.3 + a);
        const rr = R * (1 + v * 0.10 + shimmer);

        const sx = cx + x1 * rr;
        const sy = cy + y1 * rr;
        const depth = (z2 + 1) / 2; // 0 back → 1 front

        // Front particles: warm bright amber; back particles: dim ember. Alpha by depth.
        const alpha = 0.12 + depth * (0.55 + v * 0.35);
        const size = (0.9 + depth * 1.5 + v * depth * 1.2) * dpr;
        ctx.fillStyle =
          depth > 0.72
            ? `rgba(255, 231, 200, ${alpha})`
            : depth > 0.4
              ? `rgba(244, 168, 96, ${alpha})`
              : `rgba(196, 92, 32, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
