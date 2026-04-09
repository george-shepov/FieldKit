#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PORT="${PORT:-8787}"
HOST="${HOST:-0.0.0.0}"
SHARE="${SHARE:-1}"
ENABLE_API="${ENABLE_API:-0}"
API_KEY="${API_KEY:-}"
DATA_DIR="${DATA_DIR:-${ROOT_DIR}/data}"

BIN="${ROOT_DIR}/dist/fieldkit-linux-amd64"
if [[ ! -x "${BIN}" ]]; then
  echo "Binary not found: ${BIN}" >&2
  echo "Run: ./scripts/build-release.sh" >&2
  exit 1
fi

args=("--host" "${HOST}" "--port" "${PORT}")
if [[ "${SHARE}" == "1" ]]; then
  args+=("--share")
fi
if [[ "${ENABLE_API}" == "1" ]]; then
  args+=("--enable-api" "--data-dir" "${DATA_DIR}")
  if [[ -n "${API_KEY}" ]]; then
    args+=("--api-key" "${API_KEY}")
  fi
fi

exec "${BIN}" "${args[@]}"
