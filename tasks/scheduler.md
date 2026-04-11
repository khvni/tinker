# W7 · Scheduler + Headless runner + Mobile approvals (Wave 2)

You are building the "it works while you don't" layer: daily/weekly/cron automations, headless long-running tasks, and the phone-based approval flow for permissioned tool calls.

**Wait for Wave 1 to merge before starting.** You depend on merged `@ramp-glass/agent-runtime`, `@ramp-glass/integrations`, `@ramp-glass/auth`.

## Context
- `ramp-glass-prd.md` §2.5 (scheduled automations), §2.7 (headless + mobile approvals), §3.4 (d) headless flow.
- `AGENTS.md` §4.3 error handling, §6 memory discipline.
- `packages/shared-types/src/scheduler.ts` — **FROZEN. Do not edit.**

## Exclusive write scope
- `packages/scheduler/**`
- `apps/desktop/src/renderer/panes/Scheduled.tsx` (new file — registered under pane kind `scheduled`)
- `apps/mobile-approvals/**` (build from scratch — React + Tailwind + a minimal signed URL server)
- A new file `apps/desktop/src/main/headless-runner.ts` for the detached runner process bootstrap

## What to build
1. `packages/scheduler/src/store.ts`: SQLite-backed job storage (`ScheduledJob` rows). Use `better-sqlite3`.
2. `packages/scheduler/src/cron.ts`: real `createScheduler` using `node-cron` for daily/weekly/custom cron. Respects `runScriptMode: nonconcurrent` for a given job.
3. `packages/scheduler/src/prompt-to-job.ts`: natural-language → `ScheduledJob`. Given a prompt like *"every morning at 8am, pull yesterday's spend anomalies and post a summary to #fin-ops,"* call Claude to extract `{cron, prompt, output}`. Validate the cron string.
4. `packages/scheduler/src/slack-output.ts`: post results of a job run to a Slack channel via the slack-bot's existing client. Import type-only from `@ramp-glass/slack-bot` (runtime is wired in the desktop app).
5. `packages/scheduler/src/headless.ts`: detached runner. Kicks off an `AgentRuntime.runTurn` with an `AbortSignal` and a permission gate.
6. `packages/scheduler/src/permissions.ts`: `PermissionRequest` → Slack DM with Approve/Deny buttons OR a signed short-lived URL that resolves to the `mobile-approvals` app. Decision comes back via webhook; the runner resumes or aborts.
7. `apps/mobile-approvals/`: minimal React + Tailwind page showing the pending tool call, approve/deny buttons, and a signed-URL enforcement. Serve from a local tunnel — see PRD §3.2 mobile row. `cloudflared` quick tunnel is acceptable for v1.
8. `apps/desktop/src/renderer/panes/Scheduled.tsx`: UI for listing, creating, deleting scheduled jobs. Users click "Schedule this" on a chat turn to jump into this pane pre-filled.

## Dependencies (merged Wave 1)
- `@ramp-glass/agent-runtime` (runtime)
- `@ramp-glass/integrations` (for Slack output)
- `@ramp-glass/auth` (for tokens via vault)
- `@ramp-glass/shared-types`

## Tests
- Unit: cron job creation/listing/removal.
- Unit: `prompt-to-job` extracts a valid cron + output target for 5 sample prompts.
- Unit: headless runner respects abort and resumes after approve, aborts after deny.
- Integration: a full end-to-end cron run using a fake Claude client that invokes `echo` tool, posts to a mocked Slack client.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/scheduler test` passes.
- [ ] Operator can describe a job in English in the desktop app, hit "Schedule", see it appear in the Scheduled pane with the correct cron.
- [ ] A mock permission request is sent as a DM / signed URL; approving resumes the run; denying aborts cleanly.
- [ ] `apps/mobile-approvals` renders the pending approval on a phone-sized viewport.

## What you must NOT do
- Do not edit `packages/shared-types`.
- Do not leak secrets into signed URLs — sign, don't embed.
- Do not let an expired signed URL allow an approval. TTL must be strict.
- Do not run headless jobs in the renderer process. They must be detached Node processes so the UI can close.

## When done
`feat(scheduler): cron + headless + mobile approvals`. PR to `main`.
