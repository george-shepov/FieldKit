#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
PID_FILE="${RUN_DIR}/fieldkit.pid"
LOG_FILE="${RUN_DIR}/fieldkit.log"
STATE_FILE="${RUN_DIR}/suite-cli.state"
SERVICE_SCRIPT="${ROOT_DIR}/scripts/suite-service.sh"
SERVICE_ENV_DIR="${HOME}/.config/fieldkit"
SERVICE_ENV_FILE="${SERVICE_ENV_DIR}/suite.env"
USE_SERVICE_MODE="${SUITE_CLI_USE_SERVICE:-1}"

DEFAULT_PORT="${PORT:-8787}"
DEFAULT_HOST="${HOST:-127.0.0.1}"
DEFAULT_API_KEY="${API_KEY:-}"

mkdir -p "${RUN_DIR}"

find_suite_pids() {
  local pattern_dist pattern_root
  pattern_dist="${ROOT_DIR}/dist/fieldkit-"
  pattern_root="${ROOT_DIR}/fieldkit"
  {
    pgrep -f "${pattern_dist}" || true
    pgrep -f "${pattern_root}" || true
  } | awk '!seen[$0]++'
}

service_mode_enabled() {
  [[ "${USE_SERVICE_MODE}" == "1" ]] || return 1
  [[ "$(detect_os)" == "linux" ]] || return 1
  command -v systemctl >/dev/null 2>&1 || return 1
  [[ -x "${SERVICE_SCRIPT}" ]] || return 1
  return 0
}

write_service_env() {
  local host data_dir
  host="${HOST_VALUE}"
  data_dir="${ROOT_DIR}/data"
  if [[ "${SHARE_VALUE}" == "1" ]]; then
    host="0.0.0.0"
  fi
  mkdir -p "${SERVICE_ENV_DIR}"
  cat >"${SERVICE_ENV_FILE}" <<EOF
PORT=${PORT_VALUE}
HOST=${host}
SHARE=${SHARE_VALUE}
ENABLE_API=${API_VALUE}
API_KEY=${API_KEY_VALUE}
DATA_DIR=${data_dir}
EOF
}

detect_os() {
  local os
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "${os}" in
    linux*) echo "linux" ;;
    darwin*) echo "darwin" ;;
    msys*|mingw*|cygwin*) echo "windows" ;;
    *) echo "${os}" ;;
  esac
}

detect_arch() {
  local arch
  arch="$(uname -m | tr '[:upper:]' '[:lower:]')"
  case "${arch}" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "${arch}" ;;
  esac
}

binary_path() {
  local os arch bin
  os="$(detect_os)"
  arch="$(detect_arch)"
  bin="${ROOT_DIR}/dist/fieldkit-${os}-${arch}"
  if [[ "${os}" == "windows" ]]; then
    bin="${bin}.exe"
  fi
  if [[ -x "${bin}" ]]; then
    echo "${bin}"
    return
  fi
  if [[ -x "${ROOT_DIR}/fieldkit" ]]; then
    echo "${ROOT_DIR}/fieldkit"
    return
  fi
  echo "${bin}"
}

is_running() {
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    return 1
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi
  rm -f "${PID_FILE}"
  return 1
}

read_state() {
  PORT_VALUE="${DEFAULT_PORT}"
  HOST_VALUE="${DEFAULT_HOST}"
  SHARE_VALUE="0"
  API_VALUE="0"
  API_KEY_VALUE="${DEFAULT_API_KEY}"
  if [[ -f "${STATE_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${STATE_FILE}"
  fi
  if [[ "${API_KEY_VALUE}" == "change-me" ]]; then
    API_KEY_VALUE=""
  fi
}

write_state() {
  cat >"${STATE_FILE}" <<EOF
PORT_VALUE=${PORT_VALUE}
HOST_VALUE=${HOST_VALUE}
SHARE_VALUE=${SHARE_VALUE}
API_VALUE=${API_VALUE}
API_KEY_VALUE=${API_KEY_VALUE@Q}
EOF
}

lan_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

status() {
  if service_mode_enabled; then
    read_state
    echo "Status mode: service"
    echo "Port:   ${PORT_VALUE}"
    echo "Mode:   $([[ "${SHARE_VALUE}" == "1" ]] && echo "LAN share" || echo "desktop-only")"
    echo "API:    $([[ "${API_VALUE}" == "1" ]] && echo "enabled" || echo "disabled")"
    "${SERVICE_SCRIPT}" status || true
    return
  fi

  read_state
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "Status: running (PID ${pid})"
    echo "Port:   ${PORT_VALUE}"
    echo "Mode:   $([[ "${SHARE_VALUE}" == "1" ]] && echo "LAN share" || echo "desktop-only")"
    echo "API:    $([[ "${API_VALUE}" == "1" ]] && echo "enabled" || echo "disabled")"
    echo "Log:    ${LOG_FILE}"
  else
    echo "Status: stopped"
    echo "Log:    ${LOG_FILE}"
  fi
  local listeners
  listeners="$(ss -ltnp 2>/dev/null | grep fieldkit || true)"
  if [[ -n "${listeners}" ]]; then
    echo "Active listeners:"
    echo "${listeners}"
  fi
}

rebuild() {
  local bin
  bin="$(binary_path)"
  echo "Rebuilding launcher..."
  (cd "${ROOT_DIR}" && go build -trimpath -o "${bin}" .)
  chmod +x "${bin}" || true
  echo "Built: ${bin}"
}

start() {
  local mode="${1:-desktop}"
  read_state

  case "${mode}" in
    desktop)
      SHARE_VALUE="0"
      API_VALUE="0"
      ;;
    lan)
      SHARE_VALUE="1"
      API_VALUE="0"
      ;;
    lan-api)
      SHARE_VALUE="1"
      API_VALUE="1"
      ;;
    *)
      echo "Unknown start mode: ${mode}" >&2
      exit 1
      ;;
  esac

  write_state

  if service_mode_enabled; then
    if "${SERVICE_SCRIPT}" install >/dev/null 2>&1; then
      write_service_env
      if "${SERVICE_SCRIPT}" restart >/dev/null 2>&1; then
        echo "Started (service mode)"
        echo "Desktop URL: http://localhost:${PORT_VALUE}/"
        if [[ "${SHARE_VALUE}" == "1" ]]; then
          local ip
          ip="$(lan_ip)"
          if [[ -n "${ip}" ]]; then
            echo "Phone URL:   http://${ip}:${PORT_VALUE}/"
          fi
        fi
        return
      fi
    fi
    echo "Service mode start failed, falling back to direct process mode..." >&2
  fi

  if is_running; then
    echo "Already running. Use: $0 restart"
    return
  fi

  local bin
  bin="$(binary_path)"
  if [[ ! -x "${bin}" ]]; then
    echo "Binary not found: ${bin}"
    echo "Run: $0 rebuild"
    exit 1
  fi

  local args=("--host" "${HOST_VALUE}" "--port" "${PORT_VALUE}")
  if [[ "${SHARE_VALUE}" == "1" ]]; then
    args+=("--share")
  fi
  if [[ "${API_VALUE}" == "1" ]]; then
    args+=("--enable-api")
    if [[ -n "${API_KEY_VALUE}" ]]; then
      args+=("--api-key" "${API_KEY_VALUE}")
    fi
  fi

  echo "" >>"${LOG_FILE}"
  echo "[$(date +'%F %T')] starting ${bin} ${args[*]}" >>"${LOG_FILE}"
  nohup "${bin}" "${args[@]}" >>"${LOG_FILE}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" >"${PID_FILE}"

  sleep 0.5
  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    echo "Failed to start. Check log: ${LOG_FILE}" >&2
    rm -f "${PID_FILE}"
    exit 1
  fi

  echo "Started (PID ${pid})"
  echo "Desktop URL: http://localhost:${PORT_VALUE}/"
  if [[ "${SHARE_VALUE}" == "1" ]]; then
    local ip
    ip="$(lan_ip)"
    if [[ -n "${ip}" ]]; then
      echo "Phone URL:   http://${ip}:${PORT_VALUE}/"
    fi
  fi
}

stop() {
  if service_mode_enabled; then
    "${SERVICE_SCRIPT}" stop >/dev/null 2>&1 || true
    rm -f "${PID_FILE}"
    echo "Stopped (service mode)"
    return
  fi

  if ! is_running; then
    echo "Already stopped"
    return
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  echo "Stopping PID ${pid}..."
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in {1..30}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${PID_FILE}"
  echo "Stopped"
}

stop_all() {
  if service_mode_enabled; then
    "${SERVICE_SCRIPT}" stop >/dev/null 2>&1 || true
  fi

  local pids
  pids="$(find_suite_pids)"
  if [[ -z "${pids}" ]]; then
    echo "No FieldKit processes found for this suite."
    rm -f "${PID_FILE}"
    return
  fi

  echo \"Stopping all suite FieldKit processes...\"
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    echo "  -> PID ${pid}"
    kill "${pid}" >/dev/null 2>&1 || true
  done <<< "${pids}"

  sleep 0.4
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  done <<< "${pids}"

  rm -f "${PID_FILE}"
  echo "All suite instances stopped."
}

restart() {
  local mode="${1:-last}"
  read_state
  case "${mode}" in
    desktop|lan|lan-api)
      ;;
    last)
      if [[ "${SHARE_VALUE}" == "1" && "${API_VALUE}" == "1" ]]; then
        mode="lan-api"
      elif [[ "${SHARE_VALUE}" == "1" ]]; then
        mode="lan"
      else
        mode="desktop"
      fi
      ;;
    *)
      echo "Unknown restart mode: ${mode}" >&2
      exit 1
      ;;
  esac

  if service_mode_enabled; then
    start "${mode}"
    return
  fi

  stop
  start "${mode}"
}

clean_start() {
  local mode="${1:-lan}"
  stop_all
  start "${mode}"
}

set_port() {
  local port="${1:-}"
  if [[ -z "${port}" || ! "${port}" =~ ^[0-9]+$ ]]; then
    echo "Usage: $0 port <number>" >&2
    exit 1
  fi
  read_state
  PORT_VALUE="${port}"
  write_state
  echo "Default port set to ${PORT_VALUE}"
}

set_api_key() {
  local key="${1:-}"
  if [[ -z "${key}" ]]; then
    echo "Usage: $0 api-key <token>" >&2
    exit 1
  fi
  read_state
  API_KEY_VALUE="${key}"
  write_state
  echo "API key updated"
}

logs() {
  if service_mode_enabled; then
    "${SERVICE_SCRIPT}" logs
    return
  fi

  touch "${LOG_FILE}"
  tail -n 120 -f "${LOG_FILE}"
}

menu() {
  while true; do
    echo ""
    echo "FieldKit Control"
    echo "1) Start (desktop)"
    echo "2) Start (LAN)"
    echo "3) Start (LAN + API)"
    echo "4) Stop"
    echo "5) Restart (last mode)"
    echo "6) Status"
    echo "7) Rebuild binary"
    echo "8) Tail logs"
    echo "9) Set port"
    echo "10) Set API key"
    echo "11) Stop ALL suite instances"
    echo "12) Clean start (LAN)"
    echo "0) Exit"
    read -r -p "Select: " choice
    case "${choice}" in
      1) start desktop ;;
      2) start lan ;;
      3) start lan-api ;;
      4) stop ;;
      5) restart last ;;
      6) status ;;
      7) rebuild ;;
      8) logs ;;
      9) read -r -p "Port: " p; set_port "${p}" ;;
      10) read -r -p "API key: " k; set_api_key "${k}" ;;
      11) stop_all ;;
      12) clean_start lan ;;
      0) break ;;
      *) echo "Invalid selection" ;;
    esac
  done
}

usage() {
  cat <<EOF
Usage: $0 [command]

Commands:
  menu                 Interactive menu (default)
  start [desktop|lan|lan-api]
  stop
  stop-all
  restart [desktop|lan|lan-api|last]
  clean-start [desktop|lan|lan-api]
  status
  rebuild
  logs
  port <number>        Set default port
  api-key <token>      Set default API key

Default mode on Linux uses service launch for reliability.
Set SUITE_CLI_USE_SERVICE=0 to force direct process mode.
EOF
}

cmd="${1:-menu}"
case "${cmd}" in
  menu) menu ;;
  start) start "${2:-desktop}" ;;
  stop) stop ;;
  stop-all) stop_all ;;
  restart) restart "${2:-last}" ;;
  clean-start) clean_start "${2:-lan}" ;;
  status) status ;;
  rebuild) rebuild ;;
  logs) logs ;;
  port) set_port "${2:-}" ;;
  api-key) set_api_key "${2:-}" ;;
  help|-h|--help) usage ;;
  *)
    echo "Unknown command: ${cmd}" >&2
    usage
    exit 1
    ;;
esac
