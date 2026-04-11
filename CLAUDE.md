# CLAUDE.md / AGENTS.md — Ramp Glass Build Guide

> This file is **identical** to `AGENTS.md`. Claude Code reads `CLAUDE.md`; OpenAI Codex, OpenCode, Cursor, and other agents read `AGENTS.md`. Keep them in sync — if you edit one, edit the other.

> **Primary spec:** `ramp-glass-prd.md` is the source of truth for *what* to build. This file governs *how* to build it. Read the PRD end-to-end before your first commit.

---

## 1. Context You Must Internalize First

You are building **Ramp Glass**, a 1:1 clone of Ramp's internal AI productivity suite as described in the public engineering post *"We Built Every Employee at Ramp Their Own AI Coworker."*

Three principles from that article govern every decision. They are repeated here because they trump any micro-preference you have about code style:

1. **Don't limit anyone's upside.** Never "simplify" a feature by removing capability. Make complexity invisible; preserve it.
2. **One person's breakthrough becomes everyone's baseline.** Anything useful one user does must be reusable by the rest of the org — this is why skills are git-backed and Dojo exists.
3. **The product is the enablement.** The UX itself teaches users. Prefer in-product nudges and "show, don't tell" over docs or onboarding modals.

If a code decision conflicts with these principles, the decision is wrong.

---

## 2. Tech Stack (from the PRD — do not drift)

| Area | Choice |
|---|---|
| Language | **TypeScript 5.6+**, `strict: true`, no `any` without a `// eslint-disable-next-line` and a reason. |
| Package manager | **pnpm** with a workspace. |
| Desktop shell | **Electron** (main + preload + renderer). |
| UI | **React 19 + Vite + Tailwind**. |
| Workspace layout | **`flexlayout-react`** (or Dockview — pick one and stick with it). |
| Agent runtime | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`). |
| Model | Default **`claude-sonnet-4-6`**. Escalate to **`claude-opus-4-6`** only for heavy reasoning tasks. |
| Local DB | **`better-sqlite3`** + `sqlite-vss` (or LibSQL) for vectors. |
| Integrations | **MCP** (Model Context Protocol) clients, one per external tool. |
| Slack | **`@slack/bolt`** in Socket Mode. |
| Auth | **Okta OIDC** via `openid-client`; tokens in the OS keychain via `keytar`. |
| Scheduler | **`node-cron`** + detached Node process for headless runs. |
| Dojo web | **Next.js 15 App Router** on **Vercel**. |
| File watching | `chokidar`. |
| Testing | **Vitest** for units, **Playwright** for Electron E2E. |

Do **not** silently swap any of these without editing `ramp-glass-prd.md` in the same commit and justifying the swap.

---

## 3. Repo Conventions

- **Monorepo root:** `/Users/khani/Desktop/projs/ramp-glass`.
- **Layout:** see `ramp-glass-prd.md` §4.
- **Branching:** work on short-lived feature branches named `phase-N-description` mapping to the phases in PRD §5. Merge to `main` only when the phase's acceptance criteria pass.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`). Scope is the package or app, e.g. `feat(agent-runtime): stream tokens to chat tab`.
- **Sync regularly.** After every meaningful milestone (end of a phase, or a set of commits that compiles and runs), push to `origin/main` (the remote `https://github.com/khvni/ramp-glass.git`). The user has asked for regular syncing.

---

## 4. Coding Standards

### 4.1 TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Prefer `type` over `interface` unless extending.
- No default exports in library packages. Named exports only.
- Zero `any`. If unavoidable, use `unknown` and narrow.
- Exhaustive `switch` on discriminated unions — use a `never` fallthrough helper:
  ```ts
  const assertNever = (x: never): never => { throw new Error(`Unexpected: ${JSON.stringify(x)}`); };
  ```

### 4.2 React

- Function components only.
- Server-less desktop renderer — no Next.js server components inside `apps/desktop`. RSC only in `apps/dojo-web`.
- State management: start with React state + context; reach for Zustand only if a store crosses 4+ components.
- Side effects: `useEffect` is a last resort. Prefer event handlers and derived state.
- No CSS-in-JS. Tailwind utility classes only. Extract to `@apply` in a `.css` file if a class string exceeds ~6 utilities and is reused.

### 4.3 Error handling

The article is explicit: *"errors aren't your fault — the system has your back."* Translate that to code:

- Integrations **self-heal**. On 401 / expired token, automatically trigger re-auth in the background. Only surface "Glass is reconnecting…" to the user, never a stack trace.
- Never throw raw errors into the UI. Catch at the component boundary; log via the app's structured logger; render a soft recovery state.
- All agent tool calls must have timeouts and cancellation. A hung tool must not freeze the pane.
- Log with context. Every log line carries `{ userId, sessionId, phase }` at minimum.

### 4.4 Comments & docs

- Default: **write no comments**. Well-named identifiers > narration.
- Comment only when the *why* is non-obvious: hidden constraint, subtle invariant, workaround for a specific bug, behavior that would surprise a reader.
- Never write comments that reference the current task, PR, or caller ("added for X flow", "used by Y"). Those rot. Put that in the commit message.
- No multi-paragraph docstrings. One short line max.

### 4.5 Tests

- Unit test anything with non-trivial logic in `packages/*`. Vitest.
- Skip unit tests for pure UI glue in `apps/desktop/src/renderer`. Test those with Playwright E2E.
- One smoke E2E per phase: "launch app, sign in (mocked), send a message, see a response."
- Memory, scheduler, and skill loader each get real integration tests (against SQLite in `:memory:`).

### 4.6 Security

- **Tokens never touch disk in plaintext.** Only `keytar` (OS keychain).
- **Electron hardening:** `contextIsolation: true`, `nodeIntegration: false`, a tight `contextBridge` API, `CSP` on every renderer window.
- **HTML rendering** in the workspace must go through DOMPurify before insertion. Prefer React's safe defaults over raw HTML injection APIs.
- **No `eval`**, no `Function(...)` constructors.
- **Prompt injection defense:** treat all integration content (Slack, Notion, Gong, etc.) as untrusted. Never concatenate it directly into a system prompt; always quote it and label it as "untrusted content."
- **Secret scanning:** every commit goes through a `gitleaks` pre-commit hook.

---

## 5. Skill Format (from PRD §2.2)

Skills are the core enablement mechanism. A skill is a markdown file with YAML frontmatter:

```markdown
---
name: analyze-gong-competitive
description: Analyze a Gong call, extract competitive mentions, and draft a battlecard.
author: sales-team
team: sales
tags: [gong, salesforce, competitive]
version: 0.1.0
requires:
  integrations: [gong, salesforce]
---

# Analyze Gong Competitive Mentions

When the user asks you to analyze a Gong call for competitive intel, do the following…

1. …
2. …
```

Rules:

- **One skill per file.** Filename is kebab-case of the `name`.
- **Git-backed, versioned, reviewed like code.** Every skill PR needs one approver.
- **No sensitive data in skills.** Skills are shared org-wide.
- **Skills are additive to the system prompt**, loaded on demand based on relevance + explicit install.

---

## 6. Memory Discipline (from PRD §2.4)

The memory system is load-bearing. Treat it with the same care as a database migration:

- **Append-only by default.** Updates are new rows with `lastSeenAt`; deletes are soft.
- **Dedupe at read time**, not write time, using entity aliases.
- **Daily synthesis** (`0 3 * * *` local) runs in a detached process so it never blocks UI.
- **Privacy:** memory is per-user, stored locally, never uploaded anywhere without explicit consent.
- **Don't over-memorize.** If a fact can be recomputed from a connected tool, don't cache it — just remember the *reference* to where it lives. (The PRD's entity model has `sources[]` for exactly this.)

---

## 7. Workspace UI Invariants (from PRD §2.8)

These are not style preferences; they are product requirements:

- **Split panes must work.** Drag a tab between panes; split horizontal; split vertical. If FlexLayout doesn't support something, file an issue and fix it — don't degrade the UX.
- **Files open automatically when the agent writes them.** Hook the agent runtime's tool-use events; surface any `write_file` or `edit_file` as a new tab in the same tab group.
- **Inline renderers** for markdown, HTML, CSV, images, syntax-highlighted code. A `.csv` opening as plain text is a bug.
- **Persistent layout.** Serialize the FlexLayout model to SQLite on every change. Restore it on launch. Next-day launch is byte-for-byte the same.
- **No modal dialogs for core flows.** Modals break the multi-pane flow. Use side panels or tabs.

---

## 8. Git Workflow

- The remote `origin` is `https://github.com/khvni/ramp-glass.git`.
- Default branch: **`main`**.
- Push to `main` after each phase in PRD §5 completes and runs.
- Never force-push `main`. Never `git reset --hard` on `main`.
- Never `--no-verify` past a failing hook — fix the underlying issue.
- **Do not add a `Co-Authored-By: Claude …` trailer to commits.** The user's repo, the user's attribution.

---

## 9. Working With Subagents / Parallel Tasks

- When a task can be parallelized (e.g. implementing three MCP clients), dispatch subagents in parallel — one per integration.
- Each subagent gets the PRD path and a scoped task description ("implement the Linear MCP client per PRD §2.1 and §3.2; interface matches `packages/integrations/src/types.ts`").
- Merge results sequentially to avoid conflicts in shared files.

---

## 10. Definition of Done for Each Phase

Each phase in PRD §5 is "done" only when **all** of the following are true:

- [ ] Code compiles with `pnpm -w build`.
- [ ] `pnpm -w test` passes.
- [ ] `pnpm -w lint` passes.
- [ ] The phase's acceptance criterion (stated in the PRD) is demonstrable in a running app.
- [ ] Changes are committed with a conventional-commit message.
- [ ] The branch is pushed to `origin/main` (or merged to `main` and pushed).
- [ ] The corresponding box in PRD §9 "Source Fidelity Checklist" is checked.

If any of those are false, the phase is not done. Do not start the next phase.

---

## 11. Things That Will Tempt You — And Are Wrong

- "Let me add a simplified onboarding wizard." — No. Principle 1. One-click SSO is the entire onboarding.
- "Let me gate the split-pane UI behind a power-user setting." — No. Principle 1. Everyone gets the full workspace.
- "Let me build a GUI skill editor." — No. Skills are markdown files reviewed like code (PRD §2.2 explicit non-goal in §7).
- "Let me add a local OSS model as a fallback." — No. v1 is Claude-only (PRD §7).
- "Let me suppress that integration error so the user doesn't see it." — No. **Self-heal** it (§4.3). Errors are never the user's fault.
- "Let me skip memory for this turn, it's slow." — No. Fix the slowness. Memory is load-bearing.
- "Let me commit this secret temporarily." — No. Never.
- "Let me write a 200-line docstring on this helper." — No. Default to no comments (§4.4).

---

## 12. When You're Stuck

1. Re-read the relevant PRD section.
2. Re-read §1 of this file (the three principles).
3. If still stuck, write a short plan, pause, and ask the user before implementing.

Ship the article. Nothing more, nothing less.
