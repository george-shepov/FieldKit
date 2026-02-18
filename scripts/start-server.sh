#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-${PORT:-8080}}"
HOST="${HOST:-0.0.0.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not found in PATH." >&2
  exit 1
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="<your-lan-ip>"
fi

echo ""
echo "Serving: ${ROOT_DIR}"
echo "Desktop URL: http://localhost:${PORT}"
echo "Phone URL:   http://${LAN_IP}:${PORT}"
echo ""
echo "Tips:"
echo "- Keep desktop and phone on the same Wi-Fi/LAN"
echo "- Press Ctrl+C to stop"
echo ""

cd "${ROOT_DIR}"
exec python3 -m http.server "${PORT}" --bind "${HOST}"
