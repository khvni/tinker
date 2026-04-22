---
type: session
date: 2026-04-22
topic: Kill FirstRun, workspace UI cleanup push, sidebar promotion to MVP, next dispatch
---

# Session — Workspace UI push + FirstRun kill

## Context handoff summary for next Claude Code instance

Read this file first. It's the continuation point. Earlier sessions established D25 (MVP refocus to 7→8 pillars), ticket scaffolding across TIN-5..TIN-186, a repeatable dispatch pattern, and a Paper-MCP-backed UI primitive push.

### Where the repo is now (2026-04-22)

- **Main**: clean, 0 open PRs at handoff.
- **Merged TINs (75+)**: all of M1 (panes+tabs + Dockview retirement), M2 core (sessions table + Tauri start/stop + JSONL writer + hydration), M3 (FilePane dispatcher + PDF/XLSX/DOCX/PPTX/HTML/code/markdown renderers + file-link open), M4 (markdown render + code copy + rAF streaming + copy-message + disclosures + composer + stop + auto-scroll + mode/reasoning/model persist), M5 (ContextBadge + wire-up + playground), M6.1/6.2/6.3/6.5/6.6 (app_settings + memory path resolver + seed + settings UI + move flow), M7.1/7.2 (opencode.json stripped + exa health check), M8 consumer providers (Google + GitHub + Microsoft) + auth sidecar spawn + keychain bridge + sign-in UX, design-system primitives shipped (Modal, Toast, Avatar, Progress, EmptyState, Skeleton, KeyboardHint, ConnectionGate, SettingsShell, ModelPicker, ContextBadge, SegmentedControl, StatusDot, Textarea, TextInput, Toggle, ClickableBadge), Paper design audit doc (TIN-176 → `reference/paper-design-audit.md`), enterprise SSO fork-guide docs (TIN-107/110/111), release pipeline infra (TIN-164/167), sidebar scaffold (TIN-149), Coach role profile (TIN-127), Playbook skill schema (TIN-112).
- **Six stale PRs got rebased today** by a single coding agent: #81 (lint/XLSX regression fix) + #82 (ConnectionGate re-landed) + #74/78/80 (rebased through conflict storms) merged; #45 + #55 closed as superseded. Main passes `pnpm -r typecheck && lint && test`.

### What got decided this session

1. **FirstRun dies.** User saw the current FirstRun screen (AI-model-sign-in + Connected-tools + Pick-a-vault tri-panel) and called it fugly. It should not exist. Workspace should open directly into a single Chat pane. Folder selection happens IN the Chat composer via a button next to ModelPicker with a file icon + "Select folder" label. No sign-in screen on boot (auth deferred to a Settings entry later). Ticket: **TIN-187** (new, L, Claude Code, Paper-MCP-backed).
2. **TIN-101 / 150 / 151 promoted from post-MVP to MVP.** Priority flipped to Urgent; labels swapped (`post-mvp` → `mvp`). Sidebar is now MVP scope. Rationale: user said "they shoulda been MVP from the start."
3. **Paper MCP = source of truth for UI.** User: "the UI in Paper IS what should exist for the MVP, excuse you." Every UI ticket must read Paper via `mcp__plugin_paper-desktop_paper__*` and match 1:1. Light mode is default (D23). Any drift without explicit reason = reject.
4. **Sessions schema gained `user_id='local-user'` placeholder** for the auth-skipped MVP path. When M8 sign-in re-enters the boot flow later, real user IDs replace the placeholder. Migration note should live in `agent-knowledge/product/decisions.md` when it's added.

### Files modified this session

- Created **TIN-187** (Kill FirstRun + folder-picker in Chat composer) — in Linear.
- Promoted **TIN-101, TIN-150, TIN-151** to MVP priority/labels — in Linear.
- This session summary file.

### Files NOT modified (but you should touch in a follow-up)

- `agent-knowledge/product/decisions.md` — add D26 "FirstRun killed; boot opens direct to workspace; folder picker lives in composer; auth deferred from boot path".
- `tinker-prd.md` §2.2 — update to match: no FirstRun, folder picked via composer button.
- `agent-knowledge/features/21-mvp-session-folder.md` — update acceptance criteria.
- `agent-knowledge/context/tasks.md` — check + flip statuses for the ~20 MVP rows that landed but may still say `review` or `not started`.

### Dispatch prompt (reusable, copy-pasteable)

This is what coding agents need. Swap only `FEATURE=TIN-X` line 1. Works for Claude Code + Codex.

```
FEATURE=TIN-X[,TIN-Y,TIN-Z]

/caveman

You are a coding agent. Deliver the listed Linear issue(s) as ONE PR. Fresh git worktree off `origin/main`. Branch: `feat/<pillar>/<slug>`.

Read: `CLAUDE.md`, `agent-knowledge/product/decisions.md` (D25 MVP scope, D14/D21/D22/D23 rules, D26 FirstRun kill once recorded), every Linear issue body + cited spec + every file path mentioned.

If the ticket is UI-flavored: use Paper MCP (`mcp__plugin_paper-desktop_paper__*`) to view the relevant artboard. Light mode is default. Work in the order: get_basic_info → get_tree_summary → get_screenshot → get_jsx / get_computed_styles / get_font_family_info. Match Paper 1:1. Use `agent-knowledge/reference/paper-design-audit.md` (TIN-176) as the token reference.

Set each Linear issue → In Progress. Comment branch name.

Spawn team via Task tool:
- Executor — ships code + tests + playground entries per acceptance bullets across all listed tickets.
- Reviewer — Elon 5-step (requirements → DELETE → simplify → cycle → automate, IN ORDER; flag adds-before-deletes, premature abstraction) + Buchan Glass principles (tokens-only UI D14/D23, defrag before add, self-healing over retry, clarity > cleverness) + CLAUDE.md §5 (strict TS, no `any`, function components, folder-per-component D21, no `dockview-react`).
- Verifier — `pnpm -r typecheck && pnpm -r lint && pnpm -r test` (+ `cd apps/desktop/src-tauri && cargo test --lib` if Rust touched). Validates every acceptance bullet visually (Paper diff) + functionally.

Loop Executor → Reviewer → Verifier until green + signed off.

Rules: no scope creep (file follow-up for out-of-scope); no `any`/`@ts-ignore`/`--no-verify`; conventional commits `feat(<pillar>): <summary>`; caveman for chat, normal prose for code + commits + PR body.

Ship:
1. Draft PR `feat(<pillar>): <summary> (TIN-X, TIN-Y, TIN-Z)`.
2. `gh pr ready`.
3. Each Linear issue → In Review + PR link attached.
4. Flip tasks.md rows to `review` + note PR #.
5. Append `agent-knowledge/context/sessions/YYYY-MM-DD-HHMM-<slug>.md`.
6. Do NOT merge — human reviews final.

If scope exceeds stated size: STOP, split in tasks.md, file follow-ups, ship the slice that fits. Don't inflate the PR.

Start.
```

### Dispatch table (next wave — 15 rows, maximum parallelism)

Split heavy toward **Claude Code** for the UI/layout/usability push user requested.

| Row | TIN(s) chained | Description | Agent |
|---|---|---|---|
| **α** | **TIN-187** | Kill FirstRun · open workspace direct · folder-picker button in Chat composer next to ModelPicker. Paper MCP for composer layout. **Highest priority — fixes the #1 fugly surface** | Claude Code |
| **β** | **TIN-182** | UI.7 Workspace shell redesign per Paper — titlebar + tab strip + pane frame + status footer. Dockview chain shipped so this is finally unblocked | Claude Code |
| **γ** | **TIN-101 + TIN-151** | Sidebar parent + shell composition (WorkspaceSidebar + Workspace + Titlebar). Sidebar now MVP. Paper MCP for sidebar card + shell layout | Claude Code |
| **δ** | **TIN-84** | M8.11 Settings Account panel — slot into SettingsShell (TIN-184). Avatar (TIN-179) + provider + sign-out. Paper MCP for section layout | Claude Code |
| **ε** | **TIN-70 + TIN-71 + TIN-175** | Settings Connections section + status dots + per-MCP retry + "+ Add tool" picker shell. Paper MCP for Connections section layout | Claude Code |
| **ζ** | **TIN-146 + TIN-147** | Attention coordinator — pane-frame edge ring + tab-dot indicator. Subscribe panes to `@tinker/attention` store | Claude Code |
| **η** | **TIN-61-call-site-migration** (create if not exists) | Wire ToastProvider (TIN-178) call sites: sign-out · memory-root change · MCP reconnect · error toasts across app. Swap raw alerts for `useToast()` | Codex |
| 1 | **TIN-47** | M4.10 ModelPicker parity verify — checklist in PR description + screenshot pair vs OpenCode Desktop | Codex |
| 2 | **TIN-60** | M6.4 Memory pane list `.md` files · click opens as FilePane tab · refreshes on path-change event | Codex |
| 3 | **TIN-63 + TIN-64 + TIN-65** | M6.7 memory injection (top-5 recency) + M6.8 auto-capture to sessions/ + M6.9 propagation pub/sub | Codex |
| 4 | **TIN-68 + TIN-69** | M7.3 qmd SMART_VAULT_PATH wiring + M7.4 smart-connections wiring — env-inject at OpenCode spawn | Codex |
| 5 | **TIN-83 + TIN-85** | M8.10 useCurrentUser hook + M8.12 silent sign-in (reads keychain refresh token on boot) | Codex |
| 6 | **TIN-86** | M8.13 per-user memory subdir creation on sign-in. Fires memory.path-changed event | Codex |
| 7 | **TIN-73** | M7.8 minimal MCP connection gate wiring — use existing ConnectionGate primitive (TIN-172, ✓) + integrate into boot path | Codex |
| 8 | **TIN-37 + TIN-91** | M3.11 retire deferred panes (delete Today/Scheduler/Playbook/VaultBrowser from build) + X.3 manual smoke-test doc in `docs/` | Codex |
| 9 | **TIN-150** | Sidebar metadata API — `GET /workspace.cards` + `POST /workspace.metadata` on host-service (or local stub for now; host-service is post-MVP) | Codex |

**Post-MVP parallel slots (user has free compute):**

| Post-MVP row | TIN(s) | Description | Agent |
|---|---|---|---|
| P1 | **TIN-146 + TIN-147 + TIN-148** | Full Attention wiring — pane frames + tab dots + sidebar card badges (may overlap with ζ; agent should dedupe) | Claude Code |
| P2 | **TIN-158 + TIN-159** | Additional MCP integrations — GitHub + Linear configs. Both need M8 user auth (done now) | Codex |
| P3 | **TIN-113 + TIN-114 + TIN-115 + TIN-116 + TIN-117** | Playbook: skill store + browse UI pane + install/publish actions + Git sync | Codex (Paper for browse UI) |
| P4 | **TIN-128 + TIN-129** | Coach recommendation engine + "For you" shelf in Playbook pane | Codex |
| P5 | **TIN-118 + TIN-119 + TIN-120 + TIN-121 + TIN-122** | Full memory pipeline — entity extractor + relationships + FTS + provenance + daily sweep | Codex |

Total dispatchable right now: **~15 rows covering ~30 tickets**. User said "as many as I can possibly hammer out in one go in parallel" — this is as wide as it gets given current dep graph + in-flight slots.

### What's still blocked

| Blocked TIN | Waiting on |
|---|---|
| TIN-20 first-run (original) | **CLOSE** — superseded by TIN-187 |
| TIN-21/22/23 session switcher + new-session button + titlebar | TIN-187 (workspace-opens-direct path) |
| TIN-72 MCP refresh on switch | TIN-68/69 (row 4) + TIN-65 (row 3) |
| TIN-88 e2e identity test | All of M8 done including TIN-187 |

### Things the user explicitly called out

- **"use Paper MCP to also check the UI"** — every UI row above must do this.
- **"the UI in Paper IS what should exist for the MVP, excuse you"** — treat Paper as spec, not suggestion.
- **"light mode version btw"** — light default per D23 reaffirmed.
- **"lean heavily towards getting Claude Code to work on as much UI stuff as possible, especially on layout and usability"** — split biases Claude Code.
- **"I have a ton of compute to put to work. I can handle it."** — don't under-dispatch.

### Open action items for the next Claude Code instance

1. Read this file.
2. Check for any drift since handoff: `git pull --ff-only origin main && gh pr list --state open`.
3. Add D26 "FirstRun killed" to `agent-knowledge/product/decisions.md` if TIN-187 hasn't landed yet (so dispatched agent has the rationale in the canonical place).
4. Close the legacy TIN-20 with a comment pointing at TIN-187.
5. Dispatch the 15 rows above in parallel to the user's agent instances.
6. Wait for merges. Check state again. Dispatch the unblocked set.
7. Flag when the MVP acceptance checklist in `agent-knowledge/context/tasks.md` goes all-green — that's ship-ready for v0.1.
