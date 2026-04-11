# W1 · Agent Runtime + Chat pane

You are building the heart of Glass: the agent runtime that drives every conversation, scheduled job, and Slack assistant, and the Chat pane that exposes it in the desktop app.

## Context (read before touching code)
- `ramp-glass-prd.md` §2.1 (tone), §2.8 (workspace UI), §3.2 (runtime), §3.3 (data model), §3.4 (runtime flows).
- `AGENTS.md` (all sections, especially §2 tech stack and §4.3 error handling).
- `packages/shared-types/src/agent.ts` — your contract. **FROZEN. Do not edit.**

## Exclusive write scope
You may write to exactly these paths — nothing else:
- `packages/agent-runtime/**`
- `apps/desktop/src/renderer/panes/Chat.tsx` (new file; delete `ChatPlaceholder.tsx` in the same PR and update `Workspace.tsx` to import `Chat.tsx` instead)

## Dependencies (read-only)
- `@ramp-glass/shared-types` for `AgentRuntime`, `TurnContext`, `Message`, `ToolDescriptor`, `ToolExecutor`.

## What to build
1. `packages/agent-runtime/src/runtime.ts`: real implementation of `createAgentRuntime` that uses the Claude Agent SDK against `claude-sonnet-4-6` by default.
2. Streaming token callback: hook `TurnContext.onToken` for every text delta.
3. Tool-use support: when the model emits a tool call, dispatch it via a `ToolExecutor` passed at construction time; push the result back into `messages` and continue the loop until `stop_reason: end_turn`.
4. Abort support via `TurnContext.signal`. Cancelling a pane must cancel the turn within one tick.
5. Timeout and error handling per `AGENTS.md` §4.3 — catch SDK errors, never throw raw into the UI.
6. `apps/desktop/src/renderer/panes/Chat.tsx`: a full chat pane with an input, a scrolling message list, streaming tokens, and a cancel button. Uses the `glass` preload API to call the main process for runtime invocation (main process owns the Anthropic API key).
7. `apps/desktop/src/main/agent-handler.ts`: an IPC handler that owns the `AgentRuntime` instance, reads `ANTHROPIC_API_KEY` from env or the token vault, and streams token events back to the renderer over `ipcMain.handle` + `webContents.send`.
8. Register a single fake tool (`echo`) for this phase so tool-use can be demonstrated end-to-end without requiring the integrations package.

## Stubs you may use
- Memory: ignore for this phase — `TurnContext.systemPrompt` can be empty or carry a short fixed string.
- Skills: ignore for this phase.
- Integrations: use only the fake `echo` tool.

## Tests (Vitest)
- Unit: `runTurn` streams tokens, handles `tool_use` → tool_result → `end_turn`, aborts on signal, respects timeout.
- Unit: malformed tool input surfaces as `isError: true` tool_result, not a thrown error.
- Use the Anthropic SDK in a mocked mode — no real API calls in CI.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/agent-runtime test` passes.
- [ ] `pnpm --filter @ramp-glass/desktop dev` launches Electron; user types in Chat pane; Claude streams a response; `echo` tool round-trips once.
- [ ] Cancel button interrupts the stream within ~1 tick.
- [ ] No raw SDK errors appear in the UI under a forced 401 or network failure — only a soft "reconnecting" state.

## What you must NOT do
- Do not edit `packages/shared-types`. Open a coordinator PR if you need a new type.
- Do not introduce LangChain, LangGraph, CrewAI, or any orchestration framework.
- Do not import any other Wave-1 package at runtime. Memory, skills, and integrations are injected via `TurnContext` only — stub them in tests.
- Do not persist the API key to disk outside `keytar` (the auth package's job, not yours).

## When done
Conventional commit, open a PR to `main` via Conductor `⌘⇧P`. Title: `feat(agent-runtime): initial runtime + Chat pane`.
