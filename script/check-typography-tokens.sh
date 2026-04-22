#!/usr/bin/env bash
#
# check-typography-tokens.sh (TIN-198)
#
# Enforces Paper 9J-0 typography parity: `font-size:` in app/package CSS must
# reference a CSS custom property (`var(--font-size-*)`), never a literal `Npx`.
#
# Run from repo root:
#   bash script/check-typography-tokens.sh
#
# Exits non-zero on any literal `font-size: <N>px` hit.

set -euo pipefail

cd "$(dirname "$0")/.."

# Match literal px font-sizes in shipped CSS — ignore `var(…)` references.
# (We also exclude node_modules and dist output just in case.)
HITS=$(grep -rnE "font-size:[[:space:]]*[0-9]+px" packages/ apps/desktop/ \
  --include="*.css" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.turbo \
  2>/dev/null || true)

if [[ -n "$HITS" ]]; then
  echo "FAIL: literal font-size hardcodes found. Use --font-size-* tokens:"
  echo "$HITS"
  exit 1
fi

echo "OK: no literal font-size px values in packages/ or apps/desktop/"
exit 0
