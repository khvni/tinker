---
type: reference
tags: [persistence, chat-history, jsonl, m8, mvp]
status: current
source_sdk: '@opencode-ai/sdk@1.4.3 (/v2/client)'
last_verified: '2026-04-21'
---

# Chat History — JSONL File Format

`[2026-04-21]` Canonical schema for per-user chat-history persistence. Consumers: M2.11 (writer) + M2.12 (hydration reader) per [[28-mvp-identity]] and [[decisions]] D25.

## TL;DR

```
<session.folderPath>/.tinker/chats/<user-id>/<session-id>.jsonl
```

One OpenCode SSE event per line. Newline-delimited JSON (RFC 8259 / ndjson). Append-only. Plain text.

Every line:

```json
{ "ts": "2026-04-21T14:33:07.812Z", "event": "<opencode-event-type>", "data": { ... } }
```

Where:

| Field | Type | Notes |
|---|---|---|
| `ts` | ISO 8601 string (UTC, ms precision) | Time the renderer/writer observed the event. Not the OpenCode server clock. |
| `event` | string | Verbatim `Event.type` from the OpenCode SDK (e.g. `message.part.delta`). |
| `data` | `unknown` | Verbatim `Event.properties`. Schema owned by OpenCode — we do not reshape it. |

Unknown/new event types are written through unchanged — forward-compatible with SDK upgrades.

## File location

```
<session.folderPath>/.tinker/chats/<user-id>/<session-id>.jsonl
```

- `session.folderPath` — absolute path the session is scoped to (folder-as-session per M2).
- `<user-id>` — Better Auth user row id (stable per provider + provider_user_id).
- `<session-id>` — OpenCode `Session.id` (e.g. `ses_01HRZ...`).
- Directory tree is created lazily on first write (`mkdir -p` equivalent via `@tauri-apps/plugin-fs`).

Rationale: keeping the JSONL next to the session folder means the folder travels with its history — users can zip a folder and move it to another machine without losing the chat.

## Filter rule — which events to persist

Persist any event whose `properties` carry a `sessionID` equal to the active session id. Skip everything else (global / project / installation / LSP / VCS / TUI / workspace / worktree / pty / mcp noise).

Concretely the MVP keeps these event types:

| `event` | What it represents | Notes |
|---|---|---|
| `session.created` | New session created | Written once at session start. |
| `session.updated` | Session metadata changed | Title, summary, permissions. |
| `session.deleted` | Session deleted | Rare; written immediately before unlink. |
| `session.status` | busy / idle / retry transition | Drives chat "thinking…" state. |
| `session.idle` | Turn complete | Hydration uses this as a turn boundary. |
| `session.compacted` | History rewritten by OpenCode | See compaction note below. |
| `session.diff` | Snapshot diffs posted | File edit summaries. |
| `session.error` | Provider / API / overflow error | Surfaced to UI error state. |
| `message.updated` | User or assistant message upserted | Authoritative per-message tokens + cost. |
| `message.removed` | Message removed | Rare; undo/retry paths. |
| `message.part.updated` | Part added or updated | Tools, reasoning, files, patches, step markers. |
| `message.part.delta` | Streaming delta for a part | Token-by-token text + reasoning. |
| `message.part.removed` | Part removed | Rare. |
| `permission.asked` | OpenCode permission prompt | Written even if UI dismissed. |
| `permission.replied` | Permission answered | Pair with `permission.asked`. |
| `question.asked` | `ask_user` overlay prompt ([[D20]]) | Preserves user-facing clarification. |
| `question.replied` | `ask_user` answered | Pair with `question.asked`. |
| `question.rejected` | `ask_user` dismissed | Pair with `question.asked`. |
| `todo.updated` | Session todo list change | Useful for replay. |

## Logical event mapping

The ticket lists logical names (`user.prompt`, `assistant.delta`, `tool.use.start`, etc.). OpenCode does not emit those directly — they map onto the SDK events above:

| Logical | Concrete SDK event |
|---|---|
| user prompt | `message.updated` with `data.info.role === 'user'` |
| assistant text streaming | `message.part.delta` with `data.field === 'text'` against a `TextPart` |
| assistant reasoning streaming | `message.part.delta` against a `ReasoningPart` (look up by `partID`) |
| assistant turn complete | `message.updated` with `data.info.role === 'assistant'` and `data.info.time.completed` set |
| tool call start | `message.part.updated` with `data.part.type === 'tool'` and `data.part.state.status` in `pending` / `running` |
| tool call end | `message.part.updated` with `data.part.type === 'tool'` and `data.part.state.status` in `completed` / `error` |
| error | `session.error` (or `message.updated` carrying `data.info.error`) |
| abort | `message.updated` with `data.info.error.name === 'MessageAbortedError'` |
| context overflow | `message.updated` with `data.info.error.name === 'ContextOverflowError'` |
| retry after overflow | `session.status` with `data.status.type === 'retry'` |

## Example payloads

### user prompt (via `message.updated`)

```json
{"ts":"2026-04-21T14:33:07.812Z","event":"message.updated","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"msg_01HRZ9K30","sessionID":"ses_01HRZ9K2X","role":"user","time":{"created":1745244787812},"agent":"build","model":{"providerID":"anthropic","modelID":"claude-sonnet-4-6"}}}}
```

### assistant text delta

```json
{"ts":"2026-04-21T14:33:08.104Z","event":"message.part.delta","data":{"sessionID":"ses_01HRZ9K2X","messageID":"msg_01HRZ9K31","partID":"prt_01HRZ9K32","field":"text","delta":"Here's"}}
```

### assistant reasoning/thinking delta

```json
{"ts":"2026-04-21T14:33:08.142Z","event":"message.part.delta","data":{"sessionID":"ses_01HRZ9K2X","messageID":"msg_01HRZ9K31","partID":"prt_01HRZ9K33","field":"text","delta":"Let me check the file first."}}
```

`partID` resolves to a `ReasoningPart` via a prior `message.part.updated` — the delta event itself does not disambiguate text vs reasoning.

### tool call start

```json
{"ts":"2026-04-21T14:33:09.051Z","event":"message.part.updated","data":{"sessionID":"ses_01HRZ9K2X","time":1745244789051,"part":{"id":"prt_01HRZ9K34","sessionID":"ses_01HRZ9K2X","messageID":"msg_01HRZ9K31","type":"tool","callID":"call_abc","tool":"read","state":{"status":"running","input":{"file":"apps/desktop/src/main.tsx"},"time":{"start":1745244789000}}}}}
```

### tool call end

```json
{"ts":"2026-04-21T14:33:09.620Z","event":"message.part.updated","data":{"sessionID":"ses_01HRZ9K2X","time":1745244789620,"part":{"id":"prt_01HRZ9K34","sessionID":"ses_01HRZ9K2X","messageID":"msg_01HRZ9K31","type":"tool","callID":"call_abc","tool":"read","state":{"status":"completed","input":{"file":"apps/desktop/src/main.tsx"},"output":"<file contents>","title":"apps/desktop/src/main.tsx","metadata":{},"time":{"start":1745244789000,"end":1745244789620}}}}}
```

### assistant turn complete (with tokens)

```json
{"ts":"2026-04-21T14:33:11.207Z","event":"message.updated","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"msg_01HRZ9K31","sessionID":"ses_01HRZ9K2X","role":"assistant","modelID":"claude-sonnet-4-6","providerID":"anthropic","parentID":"msg_01HRZ9K30","mode":"build","agent":"build","path":{"cwd":"/Users/me/vault/demo","root":"/Users/me/vault/demo"},"cost":0.0412,"tokens":{"total":17420,"input":16108,"output":1184,"reasoning":128,"cache":{"read":12400,"write":3200}},"time":{"created":1745244788000,"completed":1745244791207},"finish":"stop"}}}
```

### session idle (turn boundary)

```json
{"ts":"2026-04-21T14:33:11.210Z","event":"session.idle","data":{"sessionID":"ses_01HRZ9K2X"}}
```

### session error

```json
{"ts":"2026-04-21T14:33:11.211Z","event":"session.error","data":{"sessionID":"ses_01HRZ9K2X","error":{"name":"APIError","data":{"message":"rate limited","statusCode":429,"isRetryable":true}}}}
```

### abort (via `message.updated`)

```json
{"ts":"2026-04-21T14:33:11.215Z","event":"message.updated","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"msg_01HRZ9K31","role":"assistant","error":{"name":"MessageAbortedError","data":{"message":"aborted by user"}},"cost":0,"tokens":{"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}},"time":{"created":1745244788000,"completed":1745244791215},"modelID":"claude-sonnet-4-6","providerID":"anthropic","parentID":"msg_01HRZ9K30","mode":"build","agent":"build","path":{"cwd":"/Users/me/vault/demo","root":"/Users/me/vault/demo"}}}}
```

### session compacted

```json
{"ts":"2026-04-21T14:33:20.901Z","event":"session.compacted","data":{"sessionID":"ses_01HRZ9K2X"}}
```

### permission prompt + reply

```json
{"ts":"2026-04-21T14:33:09.000Z","event":"permission.asked","data":{"id":"prm_01","sessionID":"ses_01HRZ9K2X","permission":"write","patterns":["apps/desktop/**"],"metadata":{},"always":[],"tool":{"messageID":"msg_01HRZ9K31","callID":"call_abc"}}}
{"ts":"2026-04-21T14:33:10.500Z","event":"permission.replied","data":{"sessionID":"ses_01HRZ9K2X","requestID":"prm_01","reply":"once"}}
```

### ask_user question + reply

```json
{"ts":"2026-04-21T14:34:00.000Z","event":"question.asked","data":{"id":"qst_01","sessionID":"ses_01HRZ9K2X","questions":[{"question":"Which file did you mean?","header":"Pick file","options":[{"label":"main.tsx","description":"apps/desktop/src/main.tsx"},{"label":"App.tsx","description":"apps/desktop/src/App.tsx"}]}]}}
{"ts":"2026-04-21T14:34:03.000Z","event":"question.replied","data":{"sessionID":"ses_01HRZ9K2X","requestID":"qst_01","answers":[["main.tsx"]]}}
```

### todo updated

```json
{"ts":"2026-04-21T14:33:14.500Z","event":"todo.updated","data":{"sessionID":"ses_01HRZ9K2X","todos":[{"content":"Read main.tsx","status":"completed","priority":"medium"},{"content":"Propose fix","status":"in_progress","priority":"high"}]}}
```

### session diff

```json
{"ts":"2026-04-21T14:33:15.800Z","event":"session.diff","data":{"sessionID":"ses_01HRZ9K2X","diff":[{"file":"apps/desktop/src/main.tsx","patch":"@@ ...","additions":4,"deletions":1,"status":"modified"}]}}
```

### session status transition

```json
{"ts":"2026-04-21T14:33:07.900Z","event":"session.status","data":{"sessionID":"ses_01HRZ9K2X","status":{"type":"busy"}}}
{"ts":"2026-04-21T14:33:11.220Z","event":"session.status","data":{"sessionID":"ses_01HRZ9K2X","status":{"type":"idle"}}}
```

### session lifecycle

```json
{"ts":"2026-04-21T14:33:00.000Z","event":"session.created","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"ses_01HRZ9K2X","slug":"fix-main","projectID":"prj_01","directory":"/Users/me/vault/demo","title":"fix main","version":"1","time":{"created":1745244780000,"updated":1745244780000}}}}
{"ts":"2026-04-21T14:33:05.000Z","event":"session.updated","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"ses_01HRZ9K2X","slug":"fix-main","projectID":"prj_01","directory":"/Users/me/vault/demo","title":"fix main.tsx rendering","version":"1","time":{"created":1745244780000,"updated":1745244785000}}}}
{"ts":"2026-04-21T15:00:00.000Z","event":"session.deleted","data":{"sessionID":"ses_01HRZ9K2X","info":{"id":"ses_01HRZ9K2X","slug":"fix-main","projectID":"prj_01","directory":"/Users/me/vault/demo","title":"fix main.tsx rendering","version":"1","time":{"created":1745244780000,"updated":1745244785000}}}}
```

## Implementation notes

### Append semantics

- Writer opens the file in append mode (O_APPEND-equivalent) per event. Each write is a single line terminated by `\n`.
- No in-place edits, no rewrites, no reordering. The file is the event log.
- One `JSON.stringify` call per event → one `writeTextFile` or buffered-stream `write` call. Do not pretty-print; do not embed newlines in values (standard JSON escaping handles this).
- Directory tree is created lazily on first write via `createDir({ recursive: true })`.

### Crash safety

- Best-effort, non-blocking. The writer lives behind an async queue (unbounded in-memory, bounded by event throughput).
- Streaming path must not await disk IO. A failed disk write logs a structured warning, **never** throws back into the SSE subscription. UI continues.
- On process crash mid-write, the file may have a truncated last line. Reader (M2.12) must discard any trailing malformed line and continue from the last newline (standard ndjson recovery). Do not delete partial files.
- No `fsync` per line — OS buffer is acceptable. Lost tail on power loss is acceptable for MVP.

### Concurrency

- One writer per `(user, session)` pair. Session is open in exactly one workspace renderer. No cross-process locking.
- The writer subscribes to the same `event.subscribe()` stream the Chat pane consumes — append is a side effect, not a blocker on UI render.
- If OpenCode redelivers events after reconnect, duplicate lines are acceptable. Reader dedupes by `(event, data.info?.id ?? data.partID ?? data.id)` when hydrating.

### Rotation / retention

- **None in MVP.** Files grow unbounded. Typical session: tens of KB to a few MB. If a user reports pain we'll add a per-session cap + roll-over; not before.
- No compaction on disk even after OpenCode's `session.compacted` — the compacted event itself is logged, and the full pre-compaction history remains on disk as the durable record.
- No deletion on session delete. We keep the JSONL so the folder-as-history promise holds; `session.deleted` is appended and that's it.

### Hydration (M2.12)

- On session open: set Chat pane to `hydrating` → read the JSONL top-to-bottom → replay messages/parts into the in-memory model → then call `event.subscribe()`. Do not subscribe first (see [[28-mvp-identity]] hydration note).
- Replay is tolerant of missing `session.status` / `todo.updated` — UI-only state that can be recomputed from the message parts.
- If the file is missing or empty (fresh session), skip hydration and go straight to subscribe.

## References

- OpenCode SDK event types: `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts` (the `Event` union, line ~819)
- Existing bridge stream handler: `packages/bridge/src/stream.ts`
- Feature spec: [[28-mvp-identity]] — §Per-user chat-history persistence
- Consumers: M2.11 (writer), M2.12 (hydration reader)
