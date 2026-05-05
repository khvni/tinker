---
type: spec
tags: [spec, subagents, orchestration, opencode, bridge]
status: in-progress
ticket: TIN-130
parent: TIN-97
related: TIN-131, TIN-132
---

# Sub-Agent Orchestrator Primitive — Execution Design

> Companion to [[06-subagent-orchestration]]. Plan posted on Linear: https://linear.app/tinker/issue/TIN-130/sub-agents-orchestrator-primitive

## Goal

Land the thinnest possible bridge primitive that lets the orchestrator agent spawn subagents and have the renderer surface those events as first-class disclosures. **No new orchestration protocol** — wrap OpenCode's `SubtaskPart` / `AgentPart` events.

Sibling tickets own everything else:

- **TIN-131** — worker registry: `AgentConfig` declarations + `permission` rules for tool/agent scoping.
- **TIN-132** — chat UI: render subtask + agent_invoked events as nested disclosures.

## Decisions locked for this ticket

1. **Decomposition is model-driven.** The orchestrator agent gets the `task` permission and emits `SubtaskPartInput` directly. Tinker does not ship a caller-side `orchestrate(workers)` API in v1.
2. **Workers do not inherit memory/skill injection.** Each subagent runs with only its `AgentConfig.prompt` + the per-call `description`. Token cost stays linear in worker count.
3. **Hard cap: 5 parallel workers.** Exposed as `MAX_PARALLEL_SUBAGENTS` for callers (TIN-131) that ever need explicit decomposition. Model-driven flows are bounded by the orchestrator agent's `task` permission instead.
4. **No `Chat.tsx` or `opencode.json` changes here.** Those land in TIN-131 / TIN-132.

## Scope

### In

- Extend `TinkerStreamEvent` with `subtask` and `agent_invoked` variants.
- Branch on `part.type === 'subtask'` and `part.type === 'agent'` in `streamSessionEvents`.
- Dedupe per `partID` (the SDK can re-fire `message.part.updated` for the same part).
- New `packages/bridge/src/orchestrator.ts` exporting `MAX_PARALLEL_SUBAGENTS` + `listSubagents(client)`.
- Vitest coverage for both stream branches and `listSubagents`.
- Update [[06-subagent-orchestration]] API sketch to match SDK reality (`WorkerSpec.tools[]` was outdated — tool scoping lives in `AgentConfig.permission`).

### Out

- Worker registry (`AgentConfig` declarations) — TIN-131.
- Chat pane disclosure rendering — TIN-132.
- `opencode.json` agent declarations.
- An explicit `orchestrate(workers)` helper. If a future ticket needs caller-driven decomposition, add a thin wrapper that builds `parts: [TextPartInput, ...SubtaskPartInput[]]` and reuses `streamSessionEvents`.

## API surface

```typescript
// packages/bridge/src/stream.ts
export type TinkerStreamEvent =
  | /* ...existing variants... */
  | {
      type: 'subtask';
      partID: string;
      agent: string;
      description: string;
      prompt: string;
      providerID: string | null;
      modelID: string | null;
    }
  | { type: 'agent_invoked'; partID: string; name: string };

// packages/bridge/src/orchestrator.ts
export const MAX_PARALLEL_SUBAGENTS = 5;

export const listSubagents = async (
  client: Pick<OpencodeClient, 'app'>,
): Promise<Agent[]>;
```

## SDK shapes (verified against `@opencode-ai/sdk@1.4.3`)

```typescript
// node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts
type SubtaskPart = {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'subtask';
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
};

type SubtaskPartInput = {
  id?: string;
  type: 'subtask';
  prompt: string;
  description: string;
  agent: string;
};

type AgentPart = {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'agent';
  name: string;
  source?: { value: string; start: number; end: number };
};
```

`SubtaskPart` and `AgentPart` are emitted on the orchestrator's message via `message.part.updated`. Both are single-shot — no state machine equivalent to `ToolPart.state.status`. The actual subagent output flows back as regular text/token events on the orchestrator's message after the worker completes.

## Files touched

| File | Change |
|------|--------|
| `packages/bridge/src/stream.ts` | Extend `TinkerStreamEvent` union; add `asSubtaskEvent` + `asAgentInvokedEvent`; branch + dedupe in `streamSessionEvents`. |
| `packages/bridge/src/stream.test.ts` | Two new `it()` blocks covering subtask + agent_invoked, including dedupe. |
| `packages/bridge/src/orchestrator.ts` | New file — `MAX_PARALLEL_SUBAGENTS` + `listSubagents`. |
| `packages/bridge/src/orchestrator.test.ts` | New file — `listSubagents` + cap tests. |
| `packages/bridge/src/index.ts` | Re-export `./orchestrator.js`. |
| `agent-knowledge/features/06-subagent-orchestration.md` | Reopen note + replace stale `WorkerSpec.tools[]` API sketch with the SDK-aligned surface. |
| `agent-knowledge/context/tasks.md` | Annotate Feature 06 row with TIN-130 reopen. |
| `agent-knowledge/specs/2026-05-05-subagent-orchestrator-primitive-design.md` | This file. |

## Verification

- `pnpm --filter @tinker/bridge typecheck` — clean.
- `pnpm --filter @tinker/bridge test` — 28 tests pass (5 new across orchestrator + stream).
- `pnpm --filter @tinker/bridge lint` — clean.
- `pnpm -r typecheck` and `pnpm -r test` — green across the workspace.

## Follow-ups (out of scope, queued)

- TIN-131 — define `AgentConfig` entries for `email-drafter`, `gong-researcher`, `linear-researcher`, etc. Apply the `task` permission to the orchestrator agent so the model can decompose. Enforce `MAX_PARALLEL_SUBAGENTS` if explicit decomposition is added there.
- TIN-132 — Chat pane: render `subtask` events as nested disclosures, render `agent_invoked` as inline @-mention chips.
- A live-runtime probe (manual session against a bundled OpenCode build) to confirm the SubtaskPart event lifecycle assumption (single emit per worker completion). Currently the dedupe makes us safe either way.
