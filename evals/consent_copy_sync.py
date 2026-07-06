#!/usr/bin/env python3
"""Drift guard: the respondent-facing consent copy in the frontend must match its source of truth.

consent-landing.md (prompts/personas/) is the source; frontend/src/lib/respondent.ts renders it via
consentCopy(). If either is reworded independently, the respondent sees a promise the other half doesn't
back — a trust bug. This test extracts the plain promise strings from consentCopy() and asserts each
appears in consent-landing.md (formatting + merge fields normalized away). Templated lines (containing
${...}) are skipped: they're personalized at render, not fixed copy.

Usage:  python -m evals.consent_copy_sync    # exit 1 on drift
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MD = REPO / "prompts/personas/consent-landing.md"
TS = REPO / "frontend/src/lib/respondent.ts"

MIN_LEN = 25  # only the promise sentences, not short labels/keys


def normalize(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'")          # curly -> straight apostrophe
    s = re.sub(r"\{\{[^}]*\}\}", "", s)                          # {{merge_field}}
    s = re.sub(r"</?small>", "", s)                             # <small> wrappers
    s = re.sub(r"[*`>#\[\]]", "", s)                            # markdown punctuation
    s = re.sub(r"\s+", " ", s)                                   # collapse whitespace
    return s.strip()


def consent_strings_from_ts(text: str) -> list[str]:
    # Isolate the consentCopy(...) function body, then pull double-quoted string literals
    # that are plain (no ${...} interpolation) and long enough to be a promise sentence.
    start = text.find("export function consentCopy")
    if start == -1:
        raise SystemExit("FAIL: consentCopy() not found in respondent.ts")
    body = text[start : text.find("\n}", start)]
    out: list[str] = []
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', body):
        lit = m.group(1)
        if "${" in lit or len(lit) < MIN_LEN:
            continue
        out.append(lit.replace('\\"', '"'))
    return out


def main() -> int:
    if not MD.exists() or not TS.exists():
        print(f"warn: missing file ({MD.exists()=}, {TS.exists()=}) — skipped")
        return 0
    md_norm = normalize(MD.read_text(encoding="utf-8"))
    strings = consent_strings_from_ts(TS.read_text(encoding="utf-8"))
    if not strings:
        print("FAIL: no promise strings extracted from consentCopy() — parser or source changed shape")
        return 1
    drift = [s for s in strings if normalize(s) not in md_norm]
    for s in drift:
        print(f"DRIFT: respondent.ts consent line not found in consent-landing.md -> {s!r}")
    if drift:
        print(f"\nFAIL: {len(drift)}/{len(strings)} consent lines drifted. Reconcile respondent.ts with the source md.")
        return 1
    print(f"ok: {len(strings)} consent promise lines in sync (respondent.ts <-> consent-landing.md)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
