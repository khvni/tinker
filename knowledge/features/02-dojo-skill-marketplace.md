---
type: concept
tags: [tinker, feature, skills, dojo, marketplace]
status: not-started
priority: p1
---

# Feature 02 — Dojo Skill Marketplace

Shared, versioned, Git-backed skill library. One person's breakthrough becomes everyone's baseline.

## Goal

Skills are markdown files that teach the agent how to perform a specific task. Dojo is where skills live, are discovered, shared, and updated. Users can author skills, install skills, publish skills, and sync with team/org Git repos.

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

```markdown
---
name: skill-name-kebab-case
description: One-line description used by Sensei for recommendation
tools: [optional tool allowlist]
---

# Skill Title

## When to Use This
<clear trigger conditions>

## How to Do It
<step-by-step instructions in agent-voice>

## Examples
<if helpful>
```

## Implementation Outline

### 1. Skill storage
- `[2026-04-14]` Skills live at `<vault>/.tinker/skills/*.md` — human-readable, editable outside the app
- `[2026-04-14]` Skill frontmatter indexed into SQLite (`skills` table) for fast discovery queries by [[05-sensei-skill-discovery]]
- `[2026-04-14]` File system is source of truth; SQLite is cache — re-index on file change

### 2. Skill browser UI
- `[2026-04-14]` Dockview pane (openable from command palette)
- `[2026-04-14]` List view: name, description, connected-tools-required, installed-status
- `[2026-04-14]` Preview: rendered markdown with syntax highlighting
- `[2026-04-14]` Actions: install (copy into vault), uninstall (remove from vault), edit (open in pane), publish (Git push)

### 3. Git sync
- `[2026-04-14]` Use `simple-git` (npm) or `@napi-rs/simple-git` for cross-platform Git
- `[2026-04-14]` User configures one Git remote per Tinker install (e.g., team Dojo)
- `[2026-04-14]` Sync command: pull + merge + push in single action; conflicts surface as UI dialog
- `[2026-04-14]` Skills path in remote repo: `skills/*.md` at root

### 4. Runtime integration with OpenCode
- `[2026-04-14]` On session start, bridge package injects active skills into the OpenCode system prompt or registers as sub-agents (TBD based on OpenCode SDK capabilities)
- `[2026-04-14]` Sensei ([[05-sensei-skill-discovery]]) decides which subset to activate per session
- `[2026-04-14]` User can manually toggle skill activation per session via UI

## Authoring Flow

- `[2026-04-14]` After a successful complex task, UI prompts "Save as skill?"
- `[2026-04-14]` Agent drafts the SKILL.md from the chat turn (pre-fills name, description, steps)
- `[2026-04-14]` User reviews + edits in a pane before saving
- `[2026-04-14]` Saved skill immediately available in Dojo

## Out of Scope

- `[2026-04-14]` Centralized hosted marketplace — users BYO Git remote
- `[2026-04-14]` Skill monetization / paid skills
- `[2026-04-14]` Binary/compiled skills — markdown only

## Open Questions

- Whether to support sub-agent skills (OpenCode SDK `subagent` primitive) vs prompt-injection skills only. Leaning: both, let skill frontmatter declare.
- Skill ID collision strategy when pulling from Git — prefix with remote name? namespace by author?
- Whether Sensei's scoring model lives here or in [[05-sensei-skill-discovery]]. Answer: there.

## Open-Source References

- ClawHub (OpenClaw community skills, 44K+ skills) — pattern reference for skill discovery UX
- Hermes' self-improvement loop — pattern reference for auto-generating skills from observed activity
- `simple-git` npm package — https://www.npmjs.com/package/simple-git

## Acceptance Criteria

- [ ] Skills list renders in a Dockview pane
- [ ] User can author a new skill from a chat turn
- [ ] User can install a skill from an arbitrary `.md` file
- [ ] Git sync pulls and pushes skills to a configured remote
- [ ] Skill frontmatter is indexed into SQLite for Sensei queries
- [ ] Installed skills are activated in the OpenCode session

## Connections
- [[05-sensei-skill-discovery]] — consumer of the skill index
- [[ramp-glass]] — Dojo reference
- [[ai-agent-harnesses]] — SKILL.md / ClawHub patterns
