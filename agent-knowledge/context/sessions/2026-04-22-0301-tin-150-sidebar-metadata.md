---
type: session
date: 2026-04-22
time: 03:01
ticket: TIN-150
branch: khvni/tin150-local-stub
status: review
pr: 84
---

# TIN-150 — Workspace sidebar metadata API local stub

## Scope

Ticket body: "`POST /workspace.metadata` (contributors push) + `GET /workspace.cards` (sidebar reads). Host-service endpoint."

Per the 2026-04-22 workspace handoff, host-service remains post-MVP, so this ticket shipped the endpoint-shaped contract as a local stub instead of inventing host runtime code inside `apps/desktop`.

## What landed

- `packages/workspace-sidebar/src/metadata.ts`
  - `createWorkspaceMetadataApi()` local stub with endpoint-shaped methods:
    - `getWorkspaceCards()` for `GET /workspace.cards`
    - `postWorkspaceMetadata()` for `POST /workspace.metadata`
    - `subscribe()` for UI consumers that need live card snapshots
    - `reset()` for tests / future shell resets
  - Typed request/response payloads for future host-service parity.
  - Card lifecycle rules:
    - create card on first push
    - fallback title = `workspaceId`
    - keyed metadata upsert by `entry.key`
    - explicit remove via `removeEntryKeys` or blank entry value
    - pinned cards sort first, then newest update

- `packages/workspace-sidebar/src/index.ts`
  - Re-exports metadata API + contract types from package root.

- `packages/workspace-sidebar/src/metadata.test.ts`
  - 8 focused tests covering seed reads, create, update, remove, sort, subscribe, reset, and blank-id rejection.

## Verification

Passed:

```bash
pnpm --filter @tinker/workspace-sidebar typecheck
pnpm --filter @tinker/workspace-sidebar lint
pnpm --filter @tinker/workspace-sidebar test
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

PR: #84

## Follow-ups

- TIN-101 / TIN-151 can consume `createWorkspaceMetadataApi()` immediately while the shell/sidebar wiring lands.
- When `packages/host-service` exists, keep the payloads and swap the in-memory implementation for transport-backed calls instead of changing sidebar consumers again.
