#!/usr/bin/env python3
"""Regression guard for the client-facing no-em-dash convention (glossary: "Client-facing copy style").

Kaan reads em-dashes as an AI tell, so copy a human receives (invite/consent, interviewer line banks)
carries none. The invariant the sweep established: in these files an em-dash is allowed ONLY on an HTML
comment line (<!-- ... -->, prompt scaffolding) or a markdown header line (starts with #, document
structure). Any em-dash in body/prose/copy is a violation. Verbatim quotes/transcripts are data and are
NOT scanned here (they live in evals fixtures + respondent personas, which keep the respondent's dashes).

Usage:  python -m evals.copy_em_dash_lint      # exit 1 if any violation
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# The client-facing copy files the glossary convention governs (renderer OUTPUT is generated, not static,
# so it is guarded by the prompt's output rule instead). Extend this list as new copy files land.
TARGETS = [
    "prompts/personas/invite-email.md",
    "prompts/personas/consent-landing.md",
    "prompts/personas/pause-resume.md",
    "prompts/personas/reflect-back-close.md",
]

EM_DASH = "—"


def violations_in(path: Path) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if EM_DASH not in line:
            continue
        if "<!--" in line:            # HTML comment: prompt scaffolding, exempt
            continue
        if line.lstrip().startswith("#"):  # markdown header: document structure, exempt
            continue
        out.append((n, line.strip()))
    return out


def main() -> int:
    failed = False
    for rel in TARGETS:
        path = REPO / rel
        if not path.exists():
            print(f"warn: {rel} missing (skipped)")
            continue
        for n, text in violations_in(path):
            failed = True
            print(f"{rel}:{n}: em-dash in client-facing copy -> {text}")
    if failed:
        print("\nFAIL: recast with a comma, colon, semicolon, or two sentences (glossary: client-facing copy style).")
        return 1
    print(f"ok: no em-dashes in client-facing copy ({len(TARGETS)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
