#!/usr/bin/env zsh
# Runs when the human clicks "Run" in Conductor.
# Most Wave-1 packages do not need a long-running dev server; this script
# defaults to typecheck+test for the whole workspace so agents get fast
# feedback on whether their changes compile.
set -euo pipefail

echo "[conductor:run] workspace=$CONDUCTOR_WORKSPACE_NAME"

pnpm typecheck
pnpm test
