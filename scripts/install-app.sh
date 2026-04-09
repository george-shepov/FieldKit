#!/usr/bin/env bash
set -euo pipefail

# install-app.sh
# Usage:
#   curl -sSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install-app.sh | bash -s -- OWNER REPO APP [DEST] [REF]

OWNER="${1:-}"
REPO="${2:-}"
APP="${3:-}"
DEST="${4:-$HOME/fieldkit-apps}"
REF="${5:-main}"

if [[ -z "$OWNER" || -z "$REPO" || -z "$APP" ]]; then
  echo "Usage: install-app.sh OWNER REPO APP [DEST] [REF]" >&2
  exit 2
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

archive_url="https://codeload.github.com/${OWNER}/${REPO}/tar.gz/${REF}"
echo "Downloading ${archive_url} ..."
curl -fsSL "$archive_url" | tar -xz -C "$tmpdir"

repo_root="$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "$repo_root" ]]; then
  echo "Failed to unpack repository archive." >&2
  exit 3
fi

app_dir="$repo_root/$APP"
if [[ ! -d "$app_dir" ]]; then
  echo "App '$APP' not found in ${OWNER}/${REPO}@${REF}." >&2
  exit 4
fi

mkdir -p "$DEST"
rm -rf "$DEST/$APP"
cp -r "$app_dir" "$DEST/"

echo "Installed '$APP' to $DEST/$APP"
echo "Run locally with:"
echo "python3 -m http.server --directory \"$DEST/$APP\" 8787"
