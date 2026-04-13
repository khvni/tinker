# F0 · Foundation (serial, before Wave 1)

## Recommended coding agent
- **Primary: Codex.** Config, bundling, lockfile, OpenCode spawn verification.

## Exclusive write scope
- Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.json` (solution file), `pnpm-lock.yaml`
- `opencode.json` (MCP server config)
- `apps/desktop/src/main/opencode.ts` (spawn logic)
- `packages/shared-types/src/**` (FINAL pass — frozen after this merges)

## What to build
1. Add `@opencode-ai/sdk` and `opencode` as dependencies. Verify that `createOpencode()` from the SDK starts the server and returns a working client inside Electron's main process.
2. Create `apps/desktop/src/main/opencode.ts`: calls `createOpencode()` on app launch, exposes the client to IPC handlers, calls `client.global.health()` to verify.
3. Create `opencode.json` at repo root with placeholder MCP server entries for Gmail, Google Calendar, Google Drive.
4. Root `tsconfig.json` solution file referencing all packages/apps.
5. `pnpm install` → commit `pnpm-lock.yaml`.
6. `pnpm typecheck` passes.
7. `packages/shared-types/FROZEN.md` marker.

## Acceptance
- [ ] `createOpencode()` succeeds inside Electron main process; `client.global.health()` returns healthy.
- [ ] `pnpm typecheck` passes.
- [ ] `opencode.json` has MCP entries (they don't need to work yet — just valid config shape).

## When done
`chore(foundation): OpenCode bundling + freeze shared-types`. PR to `main`.
