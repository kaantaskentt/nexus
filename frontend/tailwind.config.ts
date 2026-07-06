import type { Config } from "tailwindcss";

// Tailwind maps semantic names onto the design tokens in globals.css —
// components use these names, never raw hex (A15.1).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-ink": "var(--accent-ink)",
        "on-accent": "var(--on-accent)",
        scrim: "var(--scrim)",
        danger: "var(--danger)",
        success: "var(--success)",
        tag: {
          scraped: "var(--tag-scraped)",
          guess: "var(--tag-guess)",
          claimed: "var(--tag-claimed)",
          confirmed: "var(--tag-confirmed)",
          verified: "var(--tag-verified)",
        },
        pain: {
          low: "var(--pain-low)",
          moderate: "var(--pain-moderate)",
          high: "var(--pain-high)",
          severe: "var(--pain-severe)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        chip: "var(--radius-chip)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
