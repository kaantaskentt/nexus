# Screenshots

Verification and provenance screenshots from build/QA runs, swept here out of the repo
root so the top level stays clean. Nothing in the app reads this folder (the Artifact
generator reads `docs/art/`), so these are reference-only.

## What lives here

- **Committed shots** — the `editor-*`, `journey-*`, `journey18-*`, and `reverify-*` sets
  are verification evidence (editor ontology checks, the A17 snapshot journey, prod
  re-verify sweeps). They are tracked so the proof travels with the repo.
- **Local scratch** — ad-hoc `*.png` design-review captures and Playwright output are
  gitignored here (`/docs/screenshots/*.png`), mirroring the root `/*.png` convention:
  design-gate artifacts, not source.

## Convention

- Commit a screenshot only when it is durable evidence someone will refer back to; name it
  `<flow>-<step>-<what>.jpg` (jpg keeps committed shots small).
- A png is treated as scratch by default. To commit one as provenance, add it explicitly
  with `git add -f docs/screenshots/<name>.png`.
