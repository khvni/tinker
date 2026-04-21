---
type: concept
tags: [tinker, feature, scheduler, automation, cron]
status: review
priority: p1
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** `@tinker/scheduler` package stays in-tree but is not wired to the MVP UI. Do not start work until MVP ships.

# Feature 04 — Native Scheduler

Scheduled prompts that run without the user. "Turn your laptop into a server" — kick off a daily standup summary, pull weekly spend anomalies, draft a Monday plan.

## Goal

User sets up a scheduled prompt in minutes ("every weekday at 8am, summarize yesterday's Calendar + unread emails and append to Today note"). It runs on schedule. Output lands in the vault and/or a notification surface.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` **Scheduled automations** — daily/weekly/custom cron, post results directly to Slack
- `[2026-04-10]` Example: finance lead pulls yesterday's spend anomalies every morning at 8am → summary posted to team channel automatically
- `[2026-04-10]` "Set up in minutes with a simple prompt"
- `[2026-04-10]` **Headless mode** — kick off a long-running task, walk away, approve permission requests from phone

## Tinker Scope

### v1 Scope
- `[2026-04-14]` **In-process scheduler** — not OS-level cron/launchd (see Open Questions)
- `[2026-04-14]` Persistent job definitions in SQLite (`jobs` table)
- `[2026-04-14]` Simple cron-expression scheduling (`@daily`, `0 8 * * 1-5`, etc.)
- `[2026-04-14]` **Output sinks**: vault markdown append, desktop notification, Today pane widget
- `[2026-04-14]` UI: "Create scheduled prompt" dialog with natural-language schedule (parsed to cron)

### v2 / later
- OS-level scheduling for reliability when app isn't running
- Dependency chains (job B runs after job A succeeds)
- Failure notifications + retry policies
- Human-in-the-loop permission requests (headless mode)

## Architecture

### Job definition

```typescript
type ScheduledJob = {
  id: string;
  name: string;
  prompt: string;          // the agent prompt to run
  schedule: string;        // cron expression
  outputSinks: OutputSink[];
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
  createdAt: Date;
};

type OutputSink =
  | { type: 'vault-append'; path: string }
  | { type: 'notification'; title: string }
  | { type: 'today-pane'; section: string };
```

### Scheduler loop

- `[2026-04-14]` Runs in the main renderer process (TypeScript) as a background timer
- `[2026-04-14]` Every minute, queries SQLite for jobs where `nextRunAt <= now` and `enabled = true`
- `[2026-04-14]` For each due job: spawn an OpenCode session, run the prompt, collect output, route to sinks, update `lastRunAt`/`nextRunAt`

### App lifecycle concerns

- `[2026-04-15]` If the app is closed when a job is due, missed runs are skipped on next launch and recorded once in job history
- `[2026-04-14]` If the app is backgrounded/sleeping, OS-level wake is NOT attempted in v1 — accept the limitation, document it
- `[2026-04-14]` Jobs that would run "every minute" are rejected at creation time (too aggressive for a desktop app)

## UI

### Create Scheduled Prompt dialog
- Natural-language prompt input
- Schedule picker (presets: daily / weekdays / weekly / custom cron)
- Output sink selector (vault path picker, notification toggle, Today pane)
- Preview: "Next run: Tomorrow at 8:00 AM"

### Scheduled Prompts pane
- List of all jobs with last run time + next run time + status
- Inline enable/disable toggle
- Manual "run now" action
- Edit / delete

## Implementation Outline

### Package boundaries
- `[2026-04-14]` **`packages/scheduler`** — new package with cron parsing (`cron-parser` npm), job execution, output routing
- `[2026-04-14]` **`packages/memory`** — adds `jobs` table + queries
- `[2026-04-14]` **`apps/desktop`** — scheduler pane UI, create dialog

### Dependencies
- `[2026-04-14]` `cron-parser` — parse + evaluate cron expressions
- `[2026-04-14]` Tauri notification plugin — desktop notifications
- `[2026-04-14]` No Rust changes for v1 — stays TypeScript

## Out of Scope ([[decisions]])

- `[2026-04-14]` Slack-native output sink in v1 (defer to Slack-via-MCP approach)
- `[2026-04-14]` OS-level scheduling (launchd/Task Scheduler/systemd) — adds cross-platform complexity
- `[2026-04-14]` Phone push notifications for permission approval (headless mode) — requires mobile companion, out of scope

## Open Questions

- **In-process vs. OS-level scheduling**: in-process is simpler but jobs don't run when app is closed. OS-level (launchd/Task Scheduler) runs reliably but requires platform-specific Rust code. Leaning in-process for v1, accept the limitation, make it clear in UI ("scheduled jobs run when Tinker is open").
- **Background throttling**: if the app is in the background, should jobs still fire? Leaning yes — the whole point is "laptop as a server."
- `[2026-04-15]` **Catch-up behavior**: missed runs are skipped, not replayed. Scheduler records one skipped-history entry with the count of missed runs.

## Security

- `[2026-04-14]` Scheduled prompts can access the same MCP integrations as interactive sessions — user should understand this at creation time
- `[2026-04-14]` Sensitive actions (sending emails, deleting files) require user confirmation in interactive mode; headless mode v1 does NOT grant that capability (defer to v2 with mobile approval flow)
- `[2026-04-14]` Output sinks must validate paths — no writing outside the vault

## Open-Source References

- `cron-parser` npm — https://www.npmjs.com/package/cron-parser
- Tauri notification plugin — https://v2.tauri.app/plugin/notification/
- Prefect / Airflow — conceptual references for job state machines (overkill for v1 but good patterns)

## Acceptance Criteria

- [ ] User can create a scheduled prompt via UI
- [ ] Job is persisted to SQLite and survives app restart
- [ ] Job runs at the scheduled time while app is open
- [ ] Output lands in the chosen sink (vault, notification, Today pane)
- [ ] User can disable/enable/delete jobs
- [ ] Job history (last 10 runs) is viewable per job
- [ ] Missed runs (app closed) are skipped, not stacked

## Connections
- [[ramp-glass]] — "laptop as a server" reference
- [[03-memory-pipeline]] — scheduler triggers the daily sweep
- [[decisions]] — in-process scheduler rationale
