// Keep the frontend's brand copy in sync with the canonical source.
//
// A13.2 single source of truth is config/brand.json at the repo root, which the
// backend reads at runtime. Vercel builds only the `frontend` root directory, so
// a `../../../config/brand.json` import is outside the build context and would fail
// in the cloud. We therefore commit a derived copy at src/lib/brand.data.json and
// refresh it from the canonical source on every local dev/build/test (predev,
// prebuild, pretest). Drift shows up as a git diff to commit — never edit the copy
// by hand. On Vercel the committed copy is used as-is (the source may be absent).
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../config/brand.json"); // repo-root config/
const dest = resolve(here, "../src/lib/brand.data.json");

if (!existsSync(source)) {
  // Vercel / any context without the repo root: keep the committed copy.
  console.log("[sync-brand] source not present, using committed copy");
  process.exit(0);
}

const next = readFileSync(source, "utf8");
const current = existsSync(dest) ? readFileSync(dest, "utf8") : null;
if (next !== current) {
  copyFileSync(source, dest);
  console.log("[sync-brand] refreshed src/lib/brand.data.json from config/brand.json");
} else {
  console.log("[sync-brand] brand.data.json already in sync");
}
