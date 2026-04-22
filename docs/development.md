# Development

Manual MVP smoke checklist for local validation before review or release.

## Setup

Run the app locally:

```bash
pnpm install
pnpm dev:desktop
```

## MVP smoke test

Mark exactly one checkbox in each `Pass` / `Fail` pair as you run the flow.

| # | Step | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | Launch the app with `pnpm dev:desktop`. Pass if the Tauri shell boots cleanly and the renderer loads without a fatal error screen. | [ ] | [ ] | |
| 2 | Complete sign-in with Google, GitHub, or Microsoft. Pass if OAuth returns to Tinker and the signed-in user is visible to the app. | [ ] | [ ] | |
| 3 | Pick a folder to create a session. Pass if a workspace opens, OpenCode starts for that folder, and the built-in MCP set (`qmd`, `smart-connections`, `exa`) reaches a connected state before chat is enabled. | [ ] | [ ] | |
| 4 | Choose a model from the picker, send one message, and wait for the reply. Pass if the response streams into the Chat pane as rendered markdown and the composer can stop an in-flight response. | [ ] | [ ] | |
| 5 | In that reply, open file links for `.pdf`, `.xlsx`, `.md`, `.html`, and `.docx`. Pass if each one opens inline in a `File` pane tab with the correct renderer. | [ ] | [ ] | |
| 6 | Watch the Chat header during streaming. Pass if the context badge is visible and its usage value updates while the response arrives. | [ ] | [ ] | |
| 7 | Open Settings and inspect Memory. Pass if the current memory root is visible, changing the location succeeds, and the app refreshes against the new per-user memory path. | [ ] | [ ] | |
| 8 | Quit and relaunch the app. Pass if silent sign-in restores the prior user, the previous session reopens, `.tinker/chats/<user-id>/<session-id>.jsonl` exists in the session folder, and prior chat history hydrates from disk. | [ ] | [ ] | |
| 9 | Sign out, then sign in as a different user. Pass if the second user sees a different session list, gets an empty memory directory on first use, and does not inherit the first user's chat history. | [ ] | [ ] | |

## Coverage

This checklist covers the MVP pillars and release-bar checks that depend on a working local app:

- M1 panes + tabs workspace
- M2 folder-scoped sessions
- M3 inline file rendering
- M4 markdown chat + model picker
- M5 context usage badge
- M6 desktop-native memory filesystem
- M7 built-in MCP servers
- M8 identity + per-user chat history persistence
