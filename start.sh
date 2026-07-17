#!/usr/bin/env bash
# Single entrypoint for both Railway services. The build context is the repo root
# (so config/ and prompts/ resolve); the process runs from backend/ where the `app`
# package lives. NEXUS_PROC selects which of the two required processes to run:
#   api    -> the FastAPI service (default; binds Railway's $PORT)
#   worker -> the queue worker that drains jobs (compile, fan-out, snapshot)
# Two Railway services share this script and differ only by NEXUS_PROC.
set -euo pipefail
cd "$(dirname "$0")/backend"

if [ -z "${PYTHON_BIN:-}" ]; then
  if [ -x ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
  else
    PYTHON_BIN="python"
  fi
fi

if [ "${NEXUS_PROC:-api}" = "worker" ]; then
  exec "$PYTHON_BIN" -m app.worker
else
  exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
fi
