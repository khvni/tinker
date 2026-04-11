#!/usr/bin/env zsh
# Runs once when Conductor creates a new workspace (worktree).
# Env vars available: CONDUCTOR_ROOT_PATH, CONDUCTOR_WORKSPACE_NAME, CONDUCTOR_PORT.
set -euo pipefail

echo "[conductor:setup] workspace=$CONDUCTOR_WORKSPACE_NAME"
echo "[conductor:setup] root=$CONDUCTOR_ROOT_PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[conductor:setup] pnpm not found — install with: npm i -g pnpm@9.12.3" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[conductor:setup] node not found — install Node 20.11+ first" >&2
  exit 1
fi

echo "[conductor:setup] installing workspace dependencies…"
pnpm install --prefer-frozen-lockfile

echo "[conductor:setup] typechecking shared-types (the frozen contract)…"
pnpm --filter @ramp-glass/shared-types typecheck

echo "[conductor:setup] done. Your worktree is ready."
echo "[conductor:setup] NEXT: open tasks/<your-package>.md and follow the brief."
