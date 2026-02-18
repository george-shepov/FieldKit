#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${DIST_DIR:-${ROOT_DIR}/dist}"
PKG_DIR="${PKG_DIR:-${DIST_DIR}/packages}"
APP="${APP:-prosepilot}"
VERSION="${VERSION:-$(date +%Y.%m.%d)}"
BUILD_IF_MISSING="${BUILD_IF_MISSING:-0}"

have_zip=0
if command -v zip >/dev/null 2>&1; then
  have_zip=1
fi

archive_bundle() {
  local src_dir="$1"
  local out_base="$2"
  local parent
  local name
  parent="$(dirname "${src_dir}")"
  name="$(basename "${src_dir}")"

  if [[ "${have_zip}" -eq 1 ]]; then
    rm -f "${out_base}.zip"
    (
      cd "${parent}"
      zip -qry "${out_base}.zip" "${name}"
    )
    echo "${out_base}.zip"
  else
    rm -f "${out_base}.tar.gz"
    tar -C "${parent}" -czf "${out_base}.tar.gz" "${name}"
    echo "${out_base}.tar.gz"
  fi
}

if [[ ! -d "${DIST_DIR}" ]]; then
  mkdir -p "${DIST_DIR}"
fi

if ! compgen -G "${DIST_DIR}/${APP}-*" >/dev/null; then
  if [[ "${BUILD_IF_MISSING}" == "1" ]]; then
    echo "No artifacts found. Running scripts/build-release.sh..."
    "${SCRIPT_DIR}/build-release.sh"
  else
    echo "No artifacts found in ${DIST_DIR}. Run ./scripts/build-release.sh first or set BUILD_IF_MISSING=1." >&2
    exit 1
  fi
fi

mkdir -p "${PKG_DIR}"
rm -rf "${PKG_DIR}/.stage"
mkdir -p "${PKG_DIR}/.stage"

manifest="${PKG_DIR}/manifest-${VERSION}.txt"
{
  echo "ProSe Pilot customer bundles"
  echo "Version: ${VERSION}"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
} >"${manifest}"

count=0
while IFS= read -r -d '' bin_path; do
  bin_name="$(basename "${bin_path}")"
  if [[ "${bin_name}" =~ ^${APP}-(linux|windows|darwin)-([a-z0-9]+)(\.exe)?$ ]]; then
    goos="${BASH_REMATCH[1]}"
    goarch="${BASH_REMATCH[2]}"
    ext="${BASH_REMATCH[3]:-}"
  else
    continue
  fi

  bundle_name="${APP}-${VERSION}-${goos}-${goarch}"
  bundle_root="${PKG_DIR}/.stage/${bundle_name}"
  mkdir -p "${bundle_root}"

  if [[ "${goos}" == "windows" ]]; then
    cp "${bin_path}" "${bundle_root}/${APP}.exe"
    run_local="run-local.bat"
    run_lan="run-lan.bat"
    cat >"${bundle_root}/run-local.bat" <<EOF
@echo off
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%${APP}.exe"
EOF
    cat >"${bundle_root}/run-lan.bat" <<EOF
@echo off
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%${APP}.exe" --share --enable-api --api-key "change-me"
EOF
  else
    cp "${bin_path}" "${bundle_root}/${APP}"
    chmod +x "${bundle_root}/${APP}"
    run_local="run-local.sh"
    run_lan="run-lan.sh"
    cat >"${bundle_root}/run-local.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec "\${DIR}/${APP}" "\$@"
EOF
    cat >"${bundle_root}/run-lan.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec "\${DIR}/${APP}" --share --enable-api --api-key "change-me" "\$@"
EOF
    chmod +x "${bundle_root}/run-local.sh" "${bundle_root}/run-lan.sh"
  fi

  cat >"${bundle_root}/README.txt" <<EOF
ProSe Pilot (${goos}/${goarch})
Version: ${VERSION}

Quick start:
1) Extract this folder.
2) Run:
   - Desktop only: ${run_local}
   - Desktop + phone on same LAN + API: ${run_lan}
3) Open the printed URL in your browser.

Important:
- For public hosting, run behind HTTPS and set a strong API key.
- API endpoints include media sync, registration, heartbeat, wishlist, and support ticket intake.
- Press F1 in launcher/apps for built-in help.
EOF

  out_base="${PKG_DIR}/${bundle_name}"
  archive_path="$(archive_bundle "${bundle_root}" "${out_base}")"
  archive_file="$(basename "${archive_path}")"
  size_h="$(du -h "${archive_path}" | awk '{print $1}')"

  {
    echo "${archive_file}"
    echo "  source: ${bin_name}"
    echo "  size: ${size_h}"
  } >>"${manifest}"
  echo "" >>"${manifest}"

  count=$((count + 1))
done < <(find "${DIST_DIR}" -maxdepth 1 -type f -name "${APP}-*" -print0 | sort -z)

rm -rf "${PKG_DIR}/.stage"

if [[ "${count}" -eq 0 ]]; then
  echo "No matching artifacts found for ${APP}-<os>-<arch> in ${DIST_DIR}" >&2
  exit 1
fi

echo "Packaged ${count} bundle(s) into ${PKG_DIR}"
echo "Manifest: ${manifest}"
ls -lh "${PKG_DIR}" | sed -n '1,200p'
