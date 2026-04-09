#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${OUT_DIR:-${ROOT_DIR}/dist}"
VERSION="${VERSION:-$(date +%Y.%m.%d)}"
APP=""

mkdir -p "${OUT_DIR}"

TARGETS=(
  "linux amd64"
  "linux arm64"
  "windows amd64"
  "windows arm64"
  "darwin amd64"
  "darwin arm64"
)

LDFLAGS="-s -w -X main.buildVersion=${VERSION}"

echo "Building FieldKit launcher"
echo "Version: ${VERSION}"
echo "Output:  ${OUT_DIR}"
echo ""

cd "${ROOT_DIR}"
for target in "${TARGETS[@]}"; do
  read -r GOOS GOARCH <<<"${target}"
  EXT=""
  if [[ "${GOOS}" == "windows" ]]; then
    EXT=".exe"
  fi

  OUT_NAME="${APP}-${GOOS}-${GOARCH}${EXT}"
  OUT_PATH="${OUT_DIR}/${OUT_NAME}"

  echo "-> ${GOOS}/${GOARCH}"
  GOOS="${GOOS}" GOARCH="${GOARCH}" CGO_ENABLED=0 \
    go build -trimpath -ldflags "${LDFLAGS}" -o "${OUT_PATH}" .
done

echo ""
echo "Done. Artifacts:"
ls -lh "${OUT_DIR}" | sed -n '1,200p'
