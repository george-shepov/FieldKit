#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_NAME="prosepilot-suite.service"
UNIT_DIR="${HOME}/.config/systemd/user"
UNIT_FILE="${UNIT_DIR}/${SERVICE_NAME}"
ENV_DIR="${HOME}/.config/prosepilot"
ENV_FILE="${ENV_DIR}/suite.env"

ensure_files() {
  mkdir -p "${UNIT_DIR}" "${ENV_DIR}"

  if [[ ! -f "${ENV_FILE}" ]]; then
    cat >"${ENV_FILE}" <<EOF
PORT=8787
HOST=0.0.0.0
SHARE=1
ENABLE_API=0
API_KEY=change-me
DATA_DIR=${ROOT_DIR}/data
EOF
  fi

  cat >"${UNIT_FILE}" <<EOF
[Unit]
Description=ProSe Pilot Suite Launcher
After=network.target

[Service]
Type=simple
WorkingDirectory=${ROOT_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${ROOT_DIR}/scripts/run-daemon.sh
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF
}

install_service() {
  ensure_files
  systemctl --user daemon-reload
  systemctl --user enable "${SERVICE_NAME}" >/dev/null
  echo "Installed ${SERVICE_NAME}"
  echo "Edit config: ${ENV_FILE}"
}

start_service() {
  systemctl --user start "${SERVICE_NAME}"
  status_service
}

stop_service() {
  systemctl --user stop "${SERVICE_NAME}" || true
  echo "Stopped ${SERVICE_NAME}"
}

restart_service() {
  systemctl --user restart "${SERVICE_NAME}"
  status_service
}

status_service() {
  systemctl --user --no-pager --full status "${SERVICE_NAME}" | sed -n '1,28p'
}

logs_service() {
  journalctl --user -u "${SERVICE_NAME}" -n 120 -f
}

uninstall_service() {
  stop_service
  systemctl --user disable "${SERVICE_NAME}" >/dev/null || true
  rm -f "${UNIT_FILE}"
  systemctl --user daemon-reload
  echo "Uninstalled ${SERVICE_NAME}"
}

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  install
  start
  stop
  restart
  status
  logs
  uninstall
EOF
}

cmd="${1:-status}"
case "${cmd}" in
  install) install_service ;;
  start) start_service ;;
  stop) stop_service ;;
  restart) restart_service ;;
  status) status_service ;;
  logs) logs_service ;;
  uninstall) uninstall_service ;;
  *) usage; exit 1 ;;
esac

