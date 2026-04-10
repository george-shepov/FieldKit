#!/usr/bin/env bash
set -euo pipefail

# install-all.sh
# Usage:
#   curl -sSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install-all.sh | bash -s -- OWNER REPO [DEST] [REF]

OWNER="${1:-}"
REPO="${2:-}"
DEST="${3:-$HOME/fieldkit-apps}"
REF="${4:-main}"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "Usage: install-all.sh OWNER REPO [DEST] [REF]" >&2
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

mkdir -p "$DEST"

installed=0
for d in "$repo_root"/*/ ; do
  if [[ -f "$d/index.html" ]]; then
    appname="$(basename "$d")"
    echo "Installing $appname..."
    rm -rf "$DEST/$appname"
    cp -r "$d" "$DEST/"
    installed=$((installed + 1))
  fi
done

echo "Installed ${installed} apps to $DEST"
echo "Run locally with:"
echo "python3 -m http.server --directory \"$DEST\" 8787"
