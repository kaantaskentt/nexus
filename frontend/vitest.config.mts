import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Unit tests for the badge/render layer (evals/frontend/badge-mapping-spec.yaml).
// Deterministic, no LLM — asserts the mapping + non-negotiable render invariants.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
