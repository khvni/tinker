#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUNDLE_ROOT="${1:-${DESKTOP_DIR}/src-tauri/target/universal-apple-darwin/release/bundle}"
MACOS_DIR="${BUNDLE_ROOT}/macos"
DMG_DIR="${BUNDLE_ROOT}/dmg"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env "APPLE_API_KEY"
require_env "APPLE_API_ISSUER"
require_env "APPLE_API_KEY_PATH"

if [[ ! -d "${MACOS_DIR}" ]]; then
  echo "Signed macOS app directory not found at ${MACOS_DIR}" >&2
  exit 1
fi

APP_PATH="$(find "${MACOS_DIR}" -maxdepth 1 -type d -name '*.app' | head -n 1)"
if [[ -z "${APP_PATH}" ]]; then
  echo "Signed app bundle not found under ${MACOS_DIR}" >&2
  exit 1
fi

if [[ ! -d "${DMG_DIR}" ]]; then
  echo "Signed DMG directory not found at ${DMG_DIR}" >&2
  exit 1
fi

DMG_PATH="$(find "${DMG_DIR}" -maxdepth 1 -type f -name '*.dmg' | head -n 1)"
if [[ -z "${DMG_PATH}" ]]; then
  echo "Signed DMG not found under ${DMG_DIR}" >&2
  exit 1
fi

echo "Submitting DMG for notarization: ${DMG_PATH}"
xcrun notarytool submit \
  "${DMG_PATH}" \
  --issuer "${APPLE_API_ISSUER}" \
  --key-id "${APPLE_API_KEY}" \
  --key "${APPLE_API_KEY_PATH}" \
  --wait

echo "Stapling app bundle"
xcrun stapler staple "${APP_PATH}"

echo "Stapling DMG"
xcrun stapler staple "${DMG_PATH}"

echo "Validating stapled artifacts"
xcrun stapler validate "${APP_PATH}"
xcrun stapler validate "${DMG_PATH}"

echo "macOS release artifacts ready"
echo "APP_PATH=${APP_PATH}"
echo "DMG_PATH=${DMG_PATH}"
