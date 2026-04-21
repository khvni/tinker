---
type: tool
tags: [ai, enterprise, internal-tooling, ramp, claude, agents, reference]
---

# Ramp Glass

Ramp's internal AI productivity suite. Built to make every employee an AI power user without configuration overhead. Published April 2026 by **Seb Goddijn** (Internal AI @ Ramp). Built by: Seb Goddijn, Shane Buchan, Cameron Leavenworth, Calvin Kipperman, Jay Sobel, Caroline Horn. Team of 4 engineers, 3 months from start to 700 DAU.

> "We don't believe in lowering the ceiling. We believe in raising the floor." — Seb Goddijn

**This is Tinker's reference implementation.** Read this before building any feature.

## Origin Problem

- `[2026-04-10]` Ramp hit 99% AI tool adoption — then noticed most people were **stuck**
- `[2026-04-10]` "Terminal windows, npm installs, and MCP configurations were too much for most people to grok"
- `[2026-04-10]` The few who pushed through had wildly different setups with no way to share what they'd learned
- `[2026-04-10]` **The models were good enough. The harness wasn't.** This framing is the whole thesis.

## Three Core Design Principles

### 1. Don't limit anyone's upside
- `[2026-04-10]` Default non-technical product approach (rails, fewer options, dummy-proof) is **explicitly rejected**
- `[2026-04-10]` Power users need: multi-window workflows, deep integrations, scheduled automations, persistent memory, reusable skills
- `[2026-04-10]` "The goal isn't to remove complexity, but to make it invisible while preserving full capability"

### 2. One person's breakthrough should become everyone's baseline
- `[2026-04-10]` Biggest failure mode: everyone figures things out alone; discoveries don't propagate
- `[2026-04-10]` Glass is designed to "compound wins into organizational capability: shared skills, propagated best practices, a floor that rises with every discovery"

### 3. The product is the enablement
- `[2026-04-10]` "No amount of workshops can match a targeted nudge while you're already doing the work"
- `[2026-04-10]` Skills show you what great AI output looks like before you know how to ask for it yourself
- `[2026-04-10]` Memory shows you that context is the difference between a generic answer and a useful one
- `[2026-04-10]` Self-healing integrations show you that errors aren't your fault
- `[2026-04-10]` "None of this was designed as education. But when you hand someone a tool that just works, they learn by doing."

## Everything Connects on Day One

- `[2026-04-10]` Glass auto-configures on install — sign in once via **Okta SSO**, all Ramp tools light up with one-click setup
- `[2026-04-10]` Includes home-grown products: Ramp Research, Ramp Inspect, Ramp CLI
- `[2026-04-10]` "When a sales rep asks Glass to pull context from a Gong call, enrich it with Salesforce data, and draft a follow-up — it just works, because everything is already connected"
- `[2026-04-10]` "This is the unsexy foundation that makes everything else possible"

**See `features/01-sso-connector-layer.md`** for how Tinker replicates this with Better Auth (Google + GitHub + Microsoft).

## Dojo — The Skills Marketplace

- `[2026-04-10]` Skills are **markdown files** that teach the agent how to perform a specific task
- `[2026-04-10]` **350+ skills shared company-wide** — Git-backed, versioned, reviewed like code
- `[2026-04-10]` Sales team example: someone figures out the best Gong call analysis → packages it → every rep has that superpower overnight
- `[2026-04-10]` CX engineer builds Zendesk investigation workflow → entire support team levels up overnight
- `[2026-04-10]` "Every skill shared raises the floor for everyone" — the marketplace is the flywheel

### Sensei — the AI guide inside Dojo

- `[2026-04-10]` Looks at which tools you've connected, your role, and what you've been working on
- `[2026-04-10]` Recommends the skills most likely to be useful to you right now
- `[2026-04-10]` A new account manager doesn't browse 350 skills — Sensei surfaces the 5 that matter on day one
- `[2026-04-10]` "Rather than expecting people to know what's available, Glass meets them where they are"

**See `features/02-playbook-skill-marketplace.md` and `features/05-coach-skill-discovery.md`** (Tinker's analogs; Ramp's product names — Dojo / Sensei — kept only when describing Ramp itself).

## Memory System

- `[2026-04-10]` On first open: full memory system built from authenticated connections — context on people, active projects, Slack channels, Notion docs, Linear tickets
- `[2026-04-10]` **24-hour synthesis and cleanup pipeline** — mines previous sessions + connected tools (Slack, Notion, Calendar) for updates
- `[2026-04-10]` "Glass can adapt to their world without them having to re-explain things every session"
- `[2026-04-10]` Agent enters each conversation with the context the user expects — "spends less time searching"

**See `features/03-memory-pipeline.md`** for Tinker's implementation.

## Glass Turns Your Laptop Into a Server

- `[2026-04-10]` **Scheduled automations** — daily/weekly/custom cron, post results to Slack; set up in minutes with a prompt
- `[2026-04-10]` Example: finance lead pulls yesterday's spend anomalies every morning at 8am → summary posted to team channel automatically
- `[2026-04-10]` **Slack-native assistants** — listen and respond in channels using full Glass setup (integrations + memory + skills)
- `[2026-04-10]` Example: ops team built a vendor policy assistant pulling Notion + Snowflake — built in an afternoon
- `[2026-04-10]` **Headless mode** — kick off a long-running task, walk away, approve permission requests from your phone

**See `features/04-native-scheduler.md`.** Slack-native presence is deferred for Tinker (see [[decisions]]).

## Workspace, Not a Chat Window

- `[2026-04-10]` **Split panes** — multiple chat sessions side-by-side, or docs/data/code alongside conversations
- `[2026-04-10]` Works like a code editor: drag tabs to rearrange, split horizontally or vertically
- `[2026-04-10]` Renders markdown, HTML, CSVs, images, and code with syntax highlighting inline as tabs
- `[2026-04-10]` When Claude creates or edits a file, it opens automatically — no switching windows
- `[2026-04-10]` Layout **persists across sessions** — workspace is exactly how you left it

**See `features/07-workspace-persistence.md`.** Tinker uses Dockview (React); Glass is likely built on a similar React panel lib.

## Why Ramp Built In-House (Not Bought)

### 1. Internal productivity is a moat
- `[2026-04-10]` "Using AI well is now a core business need. The companies that make every employee effective with AI will move faster, serve customers better, and compound advantages their competitors cannot match."
- `[2026-04-10]` "That makes internal AI infrastructure part of your moat, and **you do not hand your moat to a vendor**"

### 2. Speed
- `[2026-04-10]` When you own the tool, you see exactly where people get stuck — ship fixes the same day
- `[2026-04-10]` Slack channel where users report issues → team triages into tickets automatically → most resolved in hours

### 3. Informs external product
- `[2026-04-10]` Ramp builds AI-first products for finance teams — problems solved internally translate to customers
- `[2026-04-10]` "Glass gives us reps on the hardest AI product problems without those reps happening at customers' expense"

## The Single Most Important Learning

- `[2026-04-10]` "The people who got the most value weren't the ones who attended our training sessions. They were the ones who installed a skill on day one and immediately got a result."
- `[2026-04-10]` "The product taught them faster than we ever could."
- `[2026-04-10]` Every Glass feature is "secretly a lesson" — skills, memory, self-healing integrations each teach users something without it being framed as education

## Glass's Tech Stack (inferred / stated)

- `[2026-04-10]` Built on **Anthropic's Claude Agent SDK**
- `[2026-04-10]` Closed source (internal to Ramp)
- `[2026-04-10]` Okta SSO for auth
- `[2026-04-10]` Git-backed skill repo
- `[2026-04-10]` Slack + Notion + Salesforce + Snowflake + Gong + Linear + Google Workspace + Figma integrations

## Connections
- [[ramp-ai-adoption]] — Org-level adoption playbook (Geoff Charles)
- [[ai-agent-harnesses]] — Glass in the broader harness landscape
- [[claude-cowork]] — Glass is Ramp's internal Cowork
- [[positioning]] — How Tinker differs
