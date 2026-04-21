---
type: reference
tags: [opencode, sdk, tokens, context-window, m5]
status: current
source_sdk: '@opencode-ai/sdk@1.4.3 (/v2/client)'
last_verified: '2026-04-21'
---

# OpenCode SDK — Token Usage + Context Window

Field paths used by the MVP context usage badge ([[25-mvp-context-badge]], [[M5]]).
All type paths are from `@opencode-ai/sdk/v2/client`; endpoint paths are from the REST surface.

## TL;DR

| Goal | Path |
|---|---|
| Tokens used in model's window **right now** | `lastAssistantMessage.tokens.input + lastAssistantMessage.tokens.output + lastAssistantMessage.tokens.reasoning` (or `.total` when present) |
| Running total since session start | Sum `tokens.input + tokens.output + tokens.reasoning` across every `AssistantMessage` in `session.messages()` |
| Current model context window | `providers[providerID].models[modelID].limit.context` from `client.config.providers()` |
| Live update stream | `event.subscribe()` → `message.updated` + `message.part.updated` (`step-finish` part) |
| Reset signal | `session.compacted` event |

OpenCode exposes **no session-aggregate token field**. Aggregates must be computed client-side by summing `AssistantMessage.tokens` (authoritative) or `StepFinishPart.tokens` (per-step).

## 1. Per-message token usage (authoritative)

Type: `AssistantMessage` in `dist/v2/gen/types.gen.d.ts:488`.

```ts
type AssistantMessage = {
  id: string;
  sessionID: string;
  role: 'assistant';
  modelID: string;
  providerID: string;
  cost: number;
  tokens: {
    total?: number;                     // present when provider reports it
    input: number;                      // includes system + history + current prompt
    output: number;                     // assistant text + tool-call args
    reasoning: number;                  // thinking/reasoning tokens (Claude, o1, etc.)
    cache: { read: number; write: number };
  };
  error?: ProviderAuthError | MessageOutputLengthError | ContextOverflowError | ...;
  // ...
};
```

- `tokens.input` is the **size the model saw for that turn** — treat it as "context used going into this response".
- `tokens.cache.read` is already counted inside `tokens.input` on most providers; do not double-add.
- Prefer `tokens.total` when set; otherwise `input + output + reasoning`.
- Fetch via `client.session.messages({ path: { id: sessionID } })` or subscribe to `message.updated`.

### Example payload (`message.updated` event)

```json
{
  "type": "message.updated",
  "properties": {
    "sessionID": "ses_01HRZ...",
    "info": {
      "id": "msg_01HRZ...",
      "role": "assistant",
      "modelID": "claude-sonnet-4-6",
      "providerID": "anthropic",
      "cost": 0.0412,
      "tokens": {
        "total": 17420,
        "input": 16108,
        "output": 1184,
        "reasoning": 128,
        "cache": { "read": 12400, "write": 3200 }
      },
      "finish": "stop"
    }
  }
}
```

## 2. Per-session aggregate (computed — no direct field)

`Session` (`types.gen.d.ts:766`) carries **no** `tokens` field. Compute it:

```ts
import type { Message, AssistantMessage } from '@opencode-ai/sdk/v2/client';

const isAssistant = (m: Message): m is AssistantMessage => m.role === 'assistant';

function sessionTokensUsed(messages: Message[]): number {
  return messages.filter(isAssistant).reduce((sum, m) => {
    const t = m.tokens;
    return sum + (t.total ?? t.input + t.output + t.reasoning);
  }, 0);
}

function contextInFlight(messages: Message[]): number {
  const last = [...messages].reverse().find(isAssistant);
  if (!last) return 0;
  const t = last.tokens;
  return t.total ?? t.input + t.output + t.reasoning;
}
```

- For the **badge**, use `contextInFlight` — the badge shows "how close to the window are we?", not lifetime spend.
- Reset the in-memory counter on `session.compacted` — compaction rewrites history, so prior `tokens.input` no longer reflects the live window.

## 3. Model context window

Endpoint: `GET /config/providers` → `client.config.providers()`.

Response type (`ConfigProvidersResponses[200]`, `types.gen.d.ts:2261`):

```ts
{
  providers: Provider[];                   // each has models: { [modelID]: Model }
  default: { [providerID]: string };       // default modelID per provider
}
```

`Model.limit` (`types.gen.d.ts:1459`):

```ts
limit: {
  context: number;       // total window (input + output budget)
  input?: number;        // optional hard cap on input tokens
  output: number;        // max generated tokens per response
}
```

### Lookup pattern

```ts
const { providers } = await client.config.providers().then(r => r.data!);
const provider = providers.find(p => p.id === assistantMessage.providerID);
const model = provider?.models[assistantMessage.modelID];
const windowSize = model?.limit.context ?? null;   // null → unknown, hide badge
```

Cache the provider map per process boot; invalidate on `installation.updated` / `server.connected` events.

## 4. Fallback: per-step tokens (`step-finish` part)

Needed when you want live in-message increments before the assistant message finalizes.

`StepFinishPart` (`types.gen.d.ts:685`):

```ts
type StepFinishPart = {
  type: 'step-finish';
  messageID: string;
  sessionID: string;
  reason: string;                          // 'stop' | 'tool-calls' | 'length' | ...
  cost: number;
  tokens: {                                // identical shape to AssistantMessage.tokens
    total?: number; input: number; output: number; reasoning: number;
    cache: { read: number; write: number };
  };
};
```

- Emitted via `message.part.updated` event as the model streams steps.
- Multiple `step-finish` parts per assistant turn when tools fire mid-response — sum them for the turn, or just wait for `message.updated` with the finalized `AssistantMessage.tokens` (preferred).

## 5. Overflow + compaction signals

| Signal | Meaning | Badge action |
|---|---|---|
| `AssistantMessage.error.name === 'ContextOverflowError'` | Window exceeded | Pin badge to 100%, surface error state |
| `event.subscribe()` → `session.compacted` | Session auto-compacted (history rewritten) | Reset in-flight counter; re-fetch `session.messages()` |
| `SessionStatus` = `retry` with `attempt > 0` after overflow | Model is retrying post-compaction | Show "recompacted" state, keep window reading in place |

## References

- SDK types: `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`
- SDK methods: `node_modules/@opencode-ai/sdk/dist/v2/gen/sdk.gen.d.ts`
- Upstream docs: https://opencode.ai/docs/sdk/
- Consumers: [[25-mvp-context-badge]] (M5), chat pane `apps/desktop/src/renderer/panes/Chat.tsx`
