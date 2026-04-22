---
type: concept
tags: [tinker, feature, skills, playbook, marketplace]
status: review
priority: p1
aliases: [dojo-skill-marketplace]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** MVP has no skills system; markdown + MCP covers the same surface at lower complexity. Do not start work until MVP ships.

# Feature 02 — Playbook Skill Marketplace

Shared, versioned, Git-backed skill library. One person's breakthrough becomes everyone's baseline.

> Renamed `[2026-04-20]` from "Dojo" to "Playbook". Same feature — the martial-arts loan was swapped for a sports-idiom frame (Playbook holds skills; Coach recommends them — see [[05-coach-skill-discovery]]). Ramp Glass's equivalent is still called "Dojo"; Tinker's is "Playbook".

## Goal

Skills are markdown files that teach the agent how to perform a specific task. The Playbook is where skills live, are discovered, shared, and updated. Users can author skills, install skills, publish skills, and sync with team/org Git repos.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` Skills = **markdown files** that teach the agent how to perform a specific task
- `[2026-04-10]` **350+ skills shared company-wide** — Git-backed, versioned, reviewed like code
- `[2026-04-10]` Sales team example: someone figures out Gong call analysis → packages skill → every rep has that superpower overnight
- `[2026-04-10]` CX engineer builds Zendesk investigation workflow → entire support team levels up overnight
- `[2026-04-10]` "Every skill shared raises the floor for everyone" — the marketplace is the flywheel

## Tinker Scope

### v1 Scope
- `[2026-04-14]` **Local skill directory** in the user's vault (e.g., `<vault>/.tinker/skills/*.md`)
- `[2026-04-14]` **Skill browser UI** — list, search, preview, install/uninstall actions (Dockview pane)
- `[2026-04-14]` **Skill authoring** — right-click "save as skill" from a chat turn; edit in pane
- `[2026-04-14]` **Optional Git sync** — point Tinker at a Git repo URL; skills sync both directions (pull updates, push authored skills)

### v2 / later
- Shared "discovery feed" of popular community skills (read-only, no hosting)
- Skill review/approval workflow for teams
- Skill version pinning / update notifications

## Skill File Format

Follow the SKILL.md pattern shared with OpenClaw/Hermes (see [[ai-agent-harnesses]]):

Canonical frontmatter spec:

```markdown
---
id: skill-name-kebab-case
title: Skill Title
role: assistant
tools: [optional tool allowlist]
version: 1
author:
  name: Tinker
---

# Skill Title

## When to Use This
<clear trigger conditions>

## How to Do It
<step-by-step instructions in agent-voice>

## Examples
<if helpful>
```

Notes:
- `body` is the markdown content after the YAML frontmatter, not a frontmatter key.
- Current parser still accepts legacy `name` / `description` files so older skills continue to load.
- Extra metadata like `description` / `tags` may remain for search and UI compatibility, but canonical authoring should use `id`, `title`, `role`, `tools`, `version`, `author`, and markdown `body`.

## Implementation Outline

### 1. Skill storage
- `[2026-04-14]` Skills live at `<vault>/.tinker/skills/*.md` — human-readable, editable outside the app
- `[2026-04-14]` Skill frontmatter indexed into SQLite (`skills` table) for fast discovery queries by [[05-coach-skill-discovery]]
- `[2026-04-14]` File system is source of truth; SQLite is cache — re-index on file change

### 2. Skill browser UI
- `[2026-04-14]` Dockview pane (openable from command palette)
- `[2026-04-14]` List view: name, description, connected-tools-required, installed-status
- `[2026-04-14]` Preview: rendered markdown with syntax highlighting
- `[2026-04-14]` Actions: install (copy into vault), uninstall (remove from vault), edit (open in pane), publish (Git push)

### 3. Git sync
- `[2026-04-14]` Use `simple-git` (npm) or `@napi-rs/simple-git` for cross-platform Git
- `[2026-04-14]` User configures one Git remote per Tinker install (e.g., team Playbook)
- `[2026-04-14]` Sync command: pull + merge + push in single action; conflicts surface as UI dialog
- `[2026-04-14]` Skills path in remote repo: `skills/*.md` at root
- `[2026-04-15]` **Implementation pivot**: shipped with `@tauri-apps/plugin-shell` `Command.create('git', ...)` instead of `simple-git` / `@napi-rs/simple-git`. `simple-git` itself spawns the git CLI under Node and does not run inside the Tauri webview; `@napi-rs/simple-git` bundles platform-native binaries and bloats the app. Shelling out to system git keeps bundle small, inherits the user's credential helper (SSH agent / Keychain / Credential Manager), and avoids a second Git implementation to keep in sync. Requires git on PATH; surfaced via `isGitAvailable()` + a visible notice in the Playbook pane.
- `[2026-04-15]` Working tree is `<vault>/.tinker/` (not `.tinker/skills/`) so tracked paths match the spec's `skills/*.md` at repo root convention.
- `[2026-04-15]` `shell:allow-execute` capability scoped to `{ name: "git", cmd: "git", args: true, sidecar: false }` in `apps/desktop/src-tauri/capabilities/default.json` — any future binary requires its own scope.

### 4. Runtime integration with OpenCode
- `[2026-04-14]` On session start, bridge package injects active skills into the OpenCode system prompt or registers as sub-agents (TBD based on OpenCode SDK capabilities)
- `[2026-04-14]` Coach ([[05-coach-skill-discovery]]) decides which subset to activate per session
- `[2026-04-14]` User can manually toggle skill activation per session via UI
- `[2026-04-15]` **Shipped**: prompt-injection path only. `packages/bridge/src/skill-injector.ts` sends all active skills as a single `noReply` text part when a session is created (mirrors the memory-injector pattern). Sub-agent registration is deferred to [[06-subagent-orchestration]].
- `[2026-04-15]` Activation state lives in the `skills.active` column. Toggling a skill in the Playbook pane calls `onActiveSkillsChanged`, which bumps `App.activeSkillsRevision`; `Chat` watches that counter and aborts the current session so the next prompt opens a fresh session with the refreshed injection (avoids duplicating skill text across turns).

## Authoring Flow

- `[2026-04-14]` After a successful complex task, UI prompts "Save as skill?"
- `[2026-04-14]` Agent drafts the SKILL.md from the chat turn (pre-fills name, description, steps)
- `[2026-04-14]` User reviews + edits in a pane before saving
- `[2026-04-14]` Saved skill immediately available in the Playbook

## Out of Scope

- `[2026-04-14]` Centralized hosted marketplace — users BYO Git remote
- `[2026-04-14]` Skill monetization / paid skills
- `[2026-04-14]` Binary/compiled skills — markdown only

## Open Questions

- Whether to support sub-agent skills (OpenCode SDK `subagent` primitive) vs prompt-injection skills only. Leaning: both, let skill frontmatter declare.
- Skill ID collision strategy when pulling from Git — prefix with remote name? namespace by author?
- Whether Coach's scoring model lives here or in [[05-coach-skill-discovery]]. Answer: there.

## Open-Source References

- ClawHub (OpenClaw community skills, 44K+ skills) — pattern reference for skill discovery UX
- Hermes' self-improvement loop — pattern reference for auto-generating skills from observed activity
- `simple-git` npm package — https://www.npmjs.com/package/simple-git

## Acceptance Criteria

- [x] Skills list renders in a Dockview pane (`apps/desktop/src/renderer/panes/Playbook.tsx`)
- [x] User can author a new skill from a chat turn (Chat "Save as skill" button → Playbook pane prefilled draft)
- [x] User can install a skill from an arbitrary `.md` file (Playbook "Install from file" button → `openDialog` → `SkillStore.installFromFile`)
- [x] Git sync pulls and pushes skills to a configured remote (`packages/memory/src/skill-git.ts`, Playbook Git sync tab)
- [x] Skill frontmatter is indexed into SQLite for Coach queries (`skills` + `skills_fts` tables in `database.ts`, `SkillStore.search`)
- [x] Installed skills are activated in the OpenCode session (`packages/bridge/src/skill-injector.ts` + `Chat.ensureSession`)

## Connections
- [[05-coach-skill-discovery]] — consumer of the skill index
- [[ramp-glass]] — Dojo (Ramp's equivalent, the naming heritage we dropped)
- [[ai-agent-harnesses]] — SKILL.md / ClawHub patterns
