---
type: session
tags: [session, tin-130, subagents, orchestration, bridge]
date: 2026-05-05
ticket: TIN-130
---

# 2026-05-05 — TIN-130 sub-agent orchestrator primitive

## Outcome

Landed the bridge primitive for OpenCode subagents. Plan-only research → implementation after user reopened the D25 freeze for TIN-130.

## What changed

- `packages/bridge/src/stream.ts` — `TinkerStreamEvent` extended with `subtask` + `agent_invoked` variants. `streamSessionEvents` now branches on `part.type === 'subtask'` and `part.type === 'agent'`, deduping per `partID`.
- `packages/bridge/src/orchestrator.ts` — new module exporting `MAX_PARALLEL_SUBAGENTS = 5` and `listSubagents(client)`.
- `packages/bridge/src/orchestrator.test.ts` + new tests in `stream.test.ts`.
- `packages/bridge/src/index.ts` — re-export the orchestrator module.
- [[06-subagent-orchestration]] — reopened (status `in-progress`); replaced stale `WorkerSpec.tools[]` API sketch with the SDK-aligned surface.
- `agent-knowledge/specs/2026-05-05-subagent-orchestrator-primitive-design.md` — execution design.
- `agent-knowledge/context/tasks.md` — annotated Feature 06 with the TIN-130 reopen.

## Decisions confirmed by Ali

1. Reopen D25 for TIN-130 only (TIN-131 + TIN-132 stay queued).
2. Decomposition is **model-driven** — orchestrator agent gets the `task` permission; no caller-side `orchestrate(workers)` API in v1.
3. Workers run with **only their `AgentConfig.prompt` + per-call description** — no inherited memory/skill injection.
4. **Hard cap 5** parallel workers, exposed as `MAX_PARALLEL_SUBAGENTS`.

## Verification

- `pnpm --filter @tinker/bridge typecheck` — clean.
- `pnpm --filter @tinker/bridge test` — 28/28 pass.
- `pnpm --filter @tinker/bridge lint` — clean.
- `pnpm -r typecheck` — green across all 9 workspace projects.
- `pnpm -r test` — green (302 desktop tests + 28 bridge + 122 memory + others).

## Follow-ups

- **TIN-131** (worker registry) — define `AgentConfig` entries + apply `task` permission to the orchestrator agent.
- **TIN-132** (chat UI) — render `subtask` and `agent_invoked` events as disclosures.
- Live-runtime probe of `SubtaskPart` event lifecycle — currently dedupe makes us safe either way, but a confirmation against a bundled OpenCode build would let us drop the dedupe if events are guaranteed single-shot.

## Notes for future agents

- `SubtaskPart` and `AgentPart` are single-shot but `message.part.updated` can re-fire for the same `partID`. The bridge dedupes per partID; renderers can rely on receiving exactly one event per part.
- `client.app.agents()` returns all agents (primary + subagent + all). `listSubagents` filters to `mode === 'subagent' || mode === 'all'`.
- The `command` field on `SubtaskPart` is set when OpenCode internally invokes the `task` tool — currently unused on Tinker's side; surface it later if TIN-132 needs to disambiguate user-emitted vs. tool-emitted subtasks.
