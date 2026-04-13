# W1 · Glass Bridge + Chat pane

## Recommended coding agent
- **Primary: Claude Code.** Streaming UI, @opencode-ai/sdk integration, iterative Chat pane work.

## Exclusive write scope
- `packages/glass-bridge/**`
- `apps/desktop/src/renderer/panes/Chat.tsx`
- `apps/desktop/src/main/bridge-handler.ts` (new — IPC bridge between renderer and OpenCode SDK)

## Context
- PRD §2.1 (OpenCode backend), §3.3 (runtime flow b — sending a message).
- **OpenCode SDK docs: https://opencode.ai/docs/sdk/** — read this before writing code.
- SDK entry point: `createOpencode()` starts server + returns `{ client }`.
- Key SDK methods: `client.session.create()`, `.prompt()`, `.abort()`, `.messages()`, `client.event.subscribe()`, `client.config.providers()`, `client.auth.set()`.

## What to build
1. `packages/glass-bridge/src/client.ts`: wrap `@opencode-ai/sdk`. Receive the client from `createOpencode()` (called by the Electron main process in `main/opencode.ts`). Wrap `client.session.*` for session lifecycle.
2. `packages/glass-bridge/src/stream.ts`: subscribe to `client.event.subscribe()` SSE stream. Convert OpenCode events into `AsyncIterable<StreamEvent>` (token deltas, tool calls, tool results, file writes, done, error).
3. `packages/glass-bridge/src/memory-injector.ts`: before each user turn, send a `noReply` prompt with memory context via `session.prompt({ body: { noReply: true, parts: [{ type: "text", text: memoryBlock }] } })`, then send the real user message.
4. `packages/glass-bridge/src/models.ts`: `listModels()` calls `client.config.providers()`. `setModel()` stores the selected `{ providerID, modelID }` and passes it to each `session.prompt()` call.
5. `packages/glass-bridge/src/auth.ts`: `setAuth(providerId, credentials)` calls `client.auth.set({ path: { id: providerId }, body: credentials })` to forward SSO tokens so MCP servers authenticate.
6. `apps/desktop/src/main/bridge-handler.ts`: IPC handler. Renderer calls `window.glass.sendMessage(sessionId, text)` → main process calls the bridge → streams events back via `webContents.send`.
7. `apps/desktop/src/renderer/panes/Chat.tsx`: streaming message list, input box, model selector dropdown, cancel button. Replace the placeholder.

## Tests
- Unit: stream adapter converts mock SSE into expected `StreamEvent` sequence.
- Unit: memory injector prepends entities to system prompt.
- Unit: model list returns expected shape.

## Acceptance
- [ ] User types in Chat, GPT-5.4 streams a response, tool calls round-trip.
- [ ] Model selector dropdown switches models.
- [ ] Cancel button stops the stream.
- [ ] No raw errors in UI on network failure.

## When done
`feat(glass-bridge): SDK wrapper + Chat pane`. PR to `main`.
