---
type: concept
tags: [tinker, vision, product]
---

# Tinker Vision

> Open-source Glass for the nontechnical masses. Raise the floor so every team member can move at AI speed without needing to know what an MCP server is.

> **[2026-04-21] MVP lens per [[decisions]] D25.** Vision intact. Scope narrowed for v0.1 to seven pillars that demonstrate the core loop: open a folder → chat with OpenCode → markdown-rendered replies → open any file referenced → search memory via built-in MCPs. Identity, skills, scheduler, attention, sidebar, host-service, and sub-agents are post-MVP. See `tinker-prd.md` §2 + `context/tasks.md` M1–M7.

## The Wrapper Pattern

- `[2026-04-14]` Claude Cowork wraps the **Claude Agent SDK** and serves a GUI over it
- `[2026-04-14]` Ramp Glass wraps the **Claude Agent SDK** and layers an enterprise-grade harness on top
- `[2026-04-14]` **Tinker wraps the OpenCode SDK** the same way — sidecar backend, GUI shell, enterprise-grade affordances

## The Problem Tinker Solves

- `[2026-04-14]` CLI coding agents (Claude Code, OpenCode, Codex) are powerful but require terminal comfort, MCP config, and JSON wrangling
- `[2026-04-14]` Claude Cowork solves this for individuals who already have Anthropic accounts
- `[2026-04-14]` Ramp Glass solves this for Ramp employees via Okta SSO + pre-wired integrations + shared skills
- `[2026-04-14]` **Nothing open-source solves this for other organizations** — every company wanting Glass-style adoption has to build it themselves
- `[2026-04-14]` Tinker fills that gap: fork the repo, ship it to your team, get 99.5% adoption

## What "Nontechnical Masses" Means

- `[2026-04-14]` Sellers, CX agents, ops, finance, marketing, L&D — anyone who would not write `npm install` and would not open `~/.config/opencode.json`
- `[2026-04-14]` Point product: they sign in once with Google or GitHub → connected tools light up → they ask a question → the work gets done
- `[2026-04-14]` Zero plumbing visible in the first-run path — "complexity invisible, not absent" (Tinker principle 1)

## The Raise-The-Floor Thesis

- `[2026-04-14]` Adapted from [[Glass (Ramp)]]'s design philosophy: "We don't believe in lowering the ceiling. We believe in raising the floor."
- `[2026-04-14]` L3 users keep their ceiling (OpenCode's full power — workflows, skills, multi-agent)
- `[2026-04-14]` L0-L1 users get a baseline that just works
- `[2026-04-14]` Every skill shipped by an L3 user raises the floor for L0-L1 users — this is the compounding flywheel

## Why Open Source

- `[2026-04-14]` Ramp's own thesis: "Internal AI infrastructure is part of your moat, and **you do not hand your moat to a vendor**"
- `[2026-04-14]` Every company wanting Glass-style capability has two options today: (1) build from scratch on Claude Agent SDK (Ramp's path — 4 people, 3 months), or (2) buy a closed-source vendor (hand over moat)
- `[2026-04-14]` **Tinker = option 3**: fork an open-source Glass, bolt on your own connectors, keep the moat
- `[2026-04-14]` OpenCode SDK is the open-source equivalent of Claude Agent SDK — Tinker inherits its openness

## Tech Foundation (see `tinker-prd.md` for full spec)

- `[2026-04-14]` **Tauri v2** desktop shell (Rust core, webview UI)
- `[2026-04-14]` **React 19 + `@tinker/panes`** workspace (recursive split tree + movable tabs, persistent layout; supersedes Dockview per [[decisions]] D16)
- `[2026-04-14]` **OpenCode sidecar** (localhost HTTP + SSE; `@opencode-ai/sdk`)
- `[2026-04-14]` **SQLite** for memory/layout/skill index
- `[2026-04-14]` **Obsidian-compatible markdown vault** for human-readable knowledge
- `[2026-04-14]` **Model choice delegated to OpenCode** — Tinker wraps OpenCode's SDK with a GUI model picker; OpenCode owns provider auth (local + cloud)
- `[2026-04-14]` **MCP servers** for all integrations (not custom API clients)

## Connections
- [[positioning]] — How Tinker differs from Cowork and Glass
- [[decisions]] — What's explicitly out of scope
- [[ramp-glass]] — Full Glass reference
