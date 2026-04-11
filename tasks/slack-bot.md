# W8 · Slack bot — assistants + triage (Wave 2)

You are building two things on one Slack app: (a) user-configurable Slack-native assistants that live in channels and respond with the user's full Glass context, and (b) the `#glass-help` triage listener that auto-converts issue reports into GitHub tickets.

**Wait for Wave 1 to merge.**

## Context
- `ramp-glass-prd.md` §2.6 (Slack-native assistants), §2.9 (issue triage → auto tickets).
- `AGENTS.md` §4.3, §4.6.
- `packages/shared-types/src/slack.ts` — **FROZEN. Do not edit.**

## Exclusive write scope
- `packages/slack-bot/**`

## What to build
1. `packages/slack-bot/src/app.ts`: real `createSlackBot` using `@slack/bolt` in Socket Mode. Takes `{ botToken, appToken, signingSecret }`.
2. `packages/slack-bot/src/assistants.ts`: `registerAssistant(SlackAssistant)` — wires a channel handler that, on every message, runs the Glass agent runtime with the user's memory + installed skills + registered integrations, and replies in-thread.
3. `packages/slack-bot/src/triage.ts`: `registerTriageChannel(channelId)` — listens for messages in `#glass-help`, classifies each via Claude into `{bug|feature|question|other}` + priority, opens a GitHub Issue via `@octokit/rest`, and posts the issue URL back in-thread.
4. Context injection: each invocation pulls the relevant user's Okta identity from a shared identity map (owner of the assistant) and uses *their* memory/skills/integrations. This requires the desktop app to push registrations to the bot; you expose a thin admin API for that.
5. Prompt-injection defense: PRD non-negotiable. Treat all Slack message content as untrusted. Wrap it in `<untrusted>...</untrusted>` tags in the system prompt and never let it override the system instructions.

## Dependencies (merged Wave 1)
- `@ramp-glass/agent-runtime`
- `@ramp-glass/memory`
- `@ramp-glass/skills`
- `@ramp-glass/integrations`
- `@ramp-glass/shared-types`
- `@slack/bolt`, `@octokit/rest` (add deps).

## Tests
- Unit: assistant handler calls the runtime once per message and replies with the result.
- Unit: triage classifier + GitHub Issue creation on a mocked octokit.
- Unit: prompt-injection regression — a message containing fake instructions cannot change the assistant's behavior.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/slack-bot test` passes.
- [ ] A test Slack app (any workspace) replies in-thread when pinged in a registered channel.
- [ ] Posting in `#glass-help` on the test workspace produces a real GitHub Issue in a test repo.

## What you must NOT do
- Do not persist Slack tokens in plaintext — they come from the auth vault.
- Do not let assistant responses execute tools that the assistant owner hasn't authorized.
- Do not edit `packages/shared-types`.

## When done
`feat(slack-bot): assistants + triage`. PR to `main`.
