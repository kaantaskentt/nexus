"use client";

import { useEffect, useRef } from "react";

// Audio-reactive orb — the live interview centerpiece (task #40 Lane C).
//
// This is NOT a generic blue AI orb. It's the warm cream/orange glass identity from our
// design tokens (globals.css): a fluid, fresnel-rimmed sphere that breathes while the
// interviewer listens and swells when it speaks. The motion is driven by REAL signal:
//   - `volume`  — the live VAPI `volume-level` (0..1), smoothed per-frame for 60fps.
//   - `state`   — derived from REAL VAPI speech/transcript events.
// There is no fabricated animation decoupled from the call: at volume 0 in a listening
// state the orb only breathes (an "alive/listening" cue), and every swell above that is
// the assistant's actual output level.
//
// Rendering is a self-contained raw-WebGL fragment shader (no three.js dependency). If
// WebGL is unavailable we degrade honestly to a canvas-2D orb that still reacts to the
// same real volume. `prefers-reduced-motion` drops the churn to a calm opacity breath.

export type OrbState = "connecting" | "listening" | "thinking" | "speaking";

// Per-state resting activity (idle churn) and how strongly volume drives the swell.
// Listening breathes low; speaking is lively; thinking is a slow contemplative pulse.
const STATE_ACTIVITY: Record<OrbState, number> = {
  connecting: 0.12,
  listening: 0.28,
  thinking: 0.5,
  speaking: 0.85,
};

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Fragment shader: domain-warped fbm inside a soft sphere, warm gradient core→rim, a
// fresnel glass edge, and a volume/activity-driven swell. Written for WebGL1 (GLSL ES 1.0)
// for broad support.
const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uVolume;    // smoothed real volume 0..1
uniform float uActivity;  // resting churn from state 0..1
uniform float uReduced;   // 1.0 when prefers-reduced-motion

// warm palette (sRGB /255) — from globals.css tokens
const vec3 CREAM = vec3(1.000, 0.992, 0.972); // --surface cream
const vec3 GOLD  = vec3(0.980, 0.760, 0.400); // warm amber
const vec3 ORNG  = vec3(0.910, 0.392, 0.106); // --accent #e8641b
const vec3 DEEP  = vec3(0.612, 0.239, 0.031); // --accent-ink #9c3d08

float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return v;
}

void main() {
  // centered, aspect-correct coords in roughly [-1,1]
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y) * 2.0;
  float r = length(uv);

  float t = uTime * (0.28 + uActivity * 0.5) * (1.0 - 0.8 * uReduced);
  float energy = uActivity * 0.4 + uVolume;

  // breathing scale — the orb is never perfectly still while alive
  float breath = sin(uTime * 0.85) * 0.5 + 0.5;
  float radius = 0.80 + breath * 0.02 * (1.0 - uReduced) + uVolume * 0.10;

  // Treat the disc as a sphere: recover a hemisphere z, build a surface normal.
  float inside = smoothstep(radius, radius - 0.012, r);
  float z = sqrt(max(radius * radius - r * r, 0.0)) / radius; // 1 at center → 0 at rim
  vec3 N = normalize(vec3(uv / radius, z + 1e-3));
  vec3 L = normalize(vec3(-0.35, 0.45, 0.9)); // soft key light, upper-left

  // Living interior: domain-warped fbm flowing across the surface, parallaxed by z so
  // the currents read as inside a volume, not painted on a flat disc.
  vec2 sp = uv / radius;
  vec2 warp = vec2(fbm(sp * 1.7 + t), fbm(sp * 1.7 - t + 4.7));
  float n = fbm(sp * 2.8 + warp * (0.8 + energy) + t * 0.5 - z * 0.6);
  n = mix(0.35, 1.0, n);

  // Warm translucent ramp — core is warm cream (NOT blown white), deepening to amber and
  // orange toward the rim. Depth (z) keeps the center luminous, the shoulder rich.
  float depth = clamp(1.0 - z, 0.0, 1.0);
  float mixv = clamp(depth * 1.15 + (1.0 - n) * 0.4 - 0.2, 0.0, 1.0);
  vec3 col = mix(GOLD, CREAM, smoothstep(0.55, 0.0, mixv)); // luminous warm core
  col = mix(col, ORNG, smoothstep(0.35, 0.8, mixv));
  col = mix(col, DEEP, smoothstep(0.78, 1.0, mixv));

  // Internal luminosity from the flowing substance + a gentle, capped volume bloom.
  float lum = 0.55 + n * 0.35 + z * 0.25 + uVolume * 0.3;
  col *= lum;

  // Soft sphere shading so it reads three-dimensional, not a flat glow.
  float diff = 0.6 + 0.4 * clamp(dot(N, L), 0.0, 1.0);
  col *= diff;

  // Crisp fresnel glass rim — a thin cream highlight at the edge, brighter with volume.
  float fres = pow(1.0 - z, 3.0);
  col += CREAM * fres * (0.35 + uVolume * 0.45);

  // A single soft specular glint — the tell that sells "glass".
  float spec = pow(clamp(dot(N, L), 0.0, 1.0), 24.0);
  col += CREAM * spec * 0.5;

  col = min(col, vec3(1.05)); // guard against a blown-white core

  // Alpha: solid sphere body + a faint outer bloom halo so it floats on the cream canvas.
  float halo = smoothstep(radius + 0.28, radius, r) * 0.22 * (0.4 + energy);
  float alpha = clamp(inside + halo, 0.0, 1.0);

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function VoiceOrb({
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
    if (!canvas) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? 1
        : 0;

    let raf = 0;
    let disposed = false;

    // ── Try WebGL; fall back to canvas-2D on any failure ──────────────
    const gl = (canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    }) || canvas.getContext("experimental-webgl", { alpha: true })) as
      | WebGLRenderingContext
      | null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return [w, h] as const;
    };

    const step = (smooth: React.MutableRefObject<number>, target: number, rate: number) => {
      smooth.current += (target - smooth.current) * rate;
      return smooth.current;
    };

    if (gl) {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      if (vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
      }
      if (!vs || !fs || !prog || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        runCanvas2D();
        return () => {
          disposed = true;
          cancelAnimationFrame(raf);
        };
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      // one big triangle covering the viewport
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "uRes");
      const uTime = gl.getUniformLocation(prog, "uTime");
      const uVol = gl.getUniformLocation(prog, "uVolume");
      const uAct = gl.getUniformLocation(prog, "uActivity");
      const uRed = gl.getUniformLocation(prog, "uReduced");

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const start = performance.now();
      const render = () => {
        if (disposed) return;
        const [w, h] = sizeCanvas();
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const v = step(volumeSmooth, volumeTarget.current, 0.18);
        const a = step(activitySmooth, activityTarget.current, 0.06);

        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, (performance.now() - start) / 1000);
        gl.uniform1f(uVol, v);
        gl.uniform1f(uAct, a);
        gl.uniform1f(uRed, reduced);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(render);
      };
      render();

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buf);
      };
    }

    runCanvas2D();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };

    // ── Honest fallback: warm layered radial glows, same real volume drive ──
    function runCanvas2D() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const start = performance.now();
      const render = () => {
        if (disposed) return;
        const [w, h] = sizeCanvas();
        ctx.clearRect(0, 0, w, h);
        const t = (performance.now() - start) / 1000;
        const v = step(volumeSmooth, volumeTarget.current, 0.18);
        const a = step(activitySmooth, activityTarget.current, 0.06);
        const cx = w / 2;
        const cy = h / 2;
        const breath = reduced ? 0.5 : Math.sin(t * 0.9) * 0.5 + 0.5;
        const base = Math.min(w, h) * (0.34 + v * 0.12 + breath * 0.02);

        // deep outer wash
        const g0 = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base * 1.5);
        g0.addColorStop(0, "rgba(232,100,27,0.30)");
        g0.addColorStop(1, "rgba(232,100,27,0)");
        ctx.fillStyle = g0;
        ctx.fillRect(0, 0, w, h);

        // main warm body
        const wobble = reduced ? 0 : Math.sin(t * 1.7) * base * 0.03 * (0.4 + a);
        const g1 = ctx.createRadialGradient(
          cx + wobble,
          cy - wobble * 0.6,
          base * 0.05,
          cx,
          cy,
          base,
        );
        g1.addColorStop(0, `rgba(255,253,248,${0.95})`);
        g1.addColorStop(0.35, `rgba(250,200,120,${0.85 + v * 0.15})`);
        g1.addColorStop(0.75, "rgba(232,100,27,0.85)");
        g1.addColorStop(1, "rgba(156,61,8,0.0)");
        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.arc(cx, cy, base, 0, Math.PI * 2);
        ctx.fill();

        // fresnel-ish rim
        ctx.strokeStyle = `rgba(255,253,248,${0.25 + v * 0.4})`;
        ctx.lineWidth = Math.max(1, base * 0.02);
        ctx.beginPath();
        ctx.arc(cx, cy, base * 0.96, 0, Math.PI * 2);
        ctx.stroke();

        raf = requestAnimationFrame(render);
      };
      render();
    }
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
