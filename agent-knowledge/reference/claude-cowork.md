---
type: tool
tags: [ai, anthropic, claude, cowork, reference]
---

# Claude Cowork

Anthropic's in-house agent harness that ships with Claude Desktop. Brings Claude Code's agentic capability to non-developers via GUI.

## What It Is

- `[2026-04-15]` Claude Desktop GUI wrapping Claude Code's underlying agent architecture
- `[2026-04-15]` Same agentic engine as Claude Code, different surface: chat interface instead of terminal
- `[2026-04-15]` Anthropic's framing: "Cowork is built on the very same foundations" as Claude Code
- `[2026-04-15]` Built on the [[claude-agent-sdk]] (same SDK that powers [[ramp-glass]])

## Core Architecture

- `[2026-04-15]` Claude Desktop → Cowork mode → Claude Code agent engine → local filesystem access
- `[2026-04-15]` Local file access from the desktop app (same as Claude Code CLI)
- `[2026-04-15]` Mobile dispatch: message Claude from phone → desktop machine executes with local files

## Features Cowork Adds Over Claude Code

- `[2026-04-15]` **Sub-agent coordination** — decomposes complex work into subtasks and coordinates parallel workstreams
- `[2026-04-15]` **Scheduled/recurring tasks** — both recurring and on-demand tasks (native scheduler, not cron wrapper)
- `[2026-04-15]` **Skills system** — built-in skills for docx/pptx/xlsx/pdf format generation, surfaced more seamlessly for non-technical users
- `[2026-04-15]` **Connectors + Chrome** — Claude picks fastest path: connector for Slack, Chrome for web research, screen for apps with no integration
- `[2026-04-15]` **Projects** — persistent workspaces with files, links, instructions, and memory
- `[2026-04-15]` **Mobile dispatch** — message from phone → desktop executes → results delivered back

## What Cowork Does NOT Have (vs Glass)

- `[2026-04-15]` **No org-level skill marketplace** — skills are personal, not shared-company-wide with Git backing
- `[2026-04-15]` **No skill-discovery layer** — you write or browse skills yourself; no role-based recommendations (Glass has Sensei; Tinker has [[05-coach-skill-discovery]])
- `[2026-04-15]` **No self-building memory pipeline** — projects remember what you feed them, no 24hr automated synthesis from Slack/Notion/Calendar
- `[2026-04-15]` **No SSO-as-auto-wiring** — connectors are configured individually, not "one sign-in = 30 tools light up"
- `[2026-04-15]` **No Slack-native presence** — Cowork is a separate app, not a bot living in a channel
- `[2026-04-15]` **No split-pane workspace** — chat UI with project panel, not code-editor-style layout

## Why the Distinction Matters for Tinker

- `[2026-04-15]` Cowork is a **product for individuals** wanting agentic capability without a terminal
- `[2026-04-15]` Glass is a **platform for organizations** where individual wins compound into collective intelligence
- `[2026-04-15]` Tinker targets the Glass gap, not the Cowork gap — see [[positioning]] for why

## Can Claude Code do everything Cowork does with configs?

- `[2026-04-15]` Mostly yes (~95%): sub-agents via AGENTS.md, MCP servers in JSON, skills via SKILL.md files, projects via CLAUDE.md per directory, scheduling via cron/launchd wrapper, Chrome via Claude-in-Chrome
- `[2026-04-15]` The ~5% genuine gap: **mobile dispatch** and **native scheduler UI** — convenience features, not capability gaps
- `[2026-04-15]` Cowork's real value proposition = making those features accessible to users who won't write a CLAUDE.md or configure MCP servers in JSON — **product-market fit decision, not technical**

## Connections
- [[ramp-glass]] — the enterprise-scale analogue Tinker is building
- [[claude-agent-sdk]] — the underlying SDK Cowork and Glass both wrap
- [[ai-agent-harnesses]] — Cowork in the broader harness landscape
- [[feature-gap-table]] — detailed feature comparison
