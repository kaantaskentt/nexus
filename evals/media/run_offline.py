"""Offline grader for media extract goldens — no vendor calls."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _check(meta_name: str, golden_name: str) -> list[str]:
    meta = json.loads((ROOT / "fixtures" / meta_name).read_text())
    golden = json.loads((ROOT / "goldens" / golden_name).read_text())
    errors: list[str] = []
    blob = json.dumps(golden).lower()
    for tool in meta.get("planted_tools") or []:
        if tool.lower() not in blob:
            errors.append(f"{golden_name}: missing planted tool {tool!r}")
    for tool in meta.get("forbidden_tools") or []:
        if tool.lower() in blob:
            errors.append(f"{golden_name}: invented forbidden tool {tool!r}")
    for step in meta.get("planted_steps") or []:
        if step.lower() not in blob:
            errors.append(f"{golden_name}: missing planted step {step!r}")
    return errors


def main() -> int:
    errs = []
    errs += _check("planted-ui.meta.json", "planted-ui.json")
    errs += _check("planted-screen.meta.json", "planted-screen.json")
    if errs:
        print("FAIL")
        for e in errs:
            print(" -", e)
        return 1
    print("PASS media offline goldens")
    return 0


if __name__ == "__main__":
    sys.exit(main())
