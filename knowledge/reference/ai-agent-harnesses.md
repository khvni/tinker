---
type: concept
tags: [ai, agents, harnesses, claude, opencode, reference]
---

# AI Agent Harnesses — The Landscape

An **agent harness** is the runtime layer around an LLM that gives it persistent identity, memory, skills, tools, and a workspace — turning a stateless chatbot into a long-running autonomous agent.

**Tinker's place**: Tinker is an open-source harness built on OpenCode SDK, targeting the Glass-style "enterprise harness" category. Not competing with individual harnesses like OpenClaw/Hermes.

## The Major Harnesses (April 2026)

### OpenClaw — Agent OS
- `[2026-04-04]` Built by **Peter Steinberger**; open source
- `[2026-04-08]` **346,000 GitHub stars in under 5 months** — surpassed React as most-starred repo in GitHub history
- `[2026-04-08]` **OpenAI acquihired OpenClaw** (per Meta Alchemist)
- `[2026-04-04]` 44,000+ skills on **ClawHub** (community marketplace)
- `[2026-04-04]` Supports every major messaging integration (Slack, Discord, Telegram, etc.)
- `[2026-04-04]` Personality system = 5 markdown slots on every turn: **SOUL.md** (personality) → **IDENTITY.md** (name) → **USER.md** (user context) → **AGENTS.md** (operational rules) → **TOOLS.md** (capabilities)
- `[2026-04-04]` Max per-file: 20,000 chars; bootstrap cap: 150,000 chars
- `[2026-04-04]` Location: `~/.openclaw/workspaces/[agent-name]/SOUL.md`
- `[2026-04-08]` **Security issues**: 135K+ instances exposed publicly across 82 countries; multiple CVEs; some community skills designed to steal API keys
- `[2026-04-04]` **Weakness**: static learning — doesn't self-improve. Manual skill-building.
- `[2026-04-04]` **Weakness**: basic memory — remembers facts but can't connect them across time; ~3 weeks in, loses the why behind past decisions

**What Tinker borrows**: the SKILL.md / context-slot pattern. Skills as first-class markdown files.

### Hermes Agent — Growth OS
- `[2026-04-08]` Launched **Feb 2026** by Nous Research
- `[2026-04-08]` 22,000 GitHub stars (smaller community than OpenClaw)
- `[2026-04-08]` **Key differentiator: self-improvement loops** — watches user activity, builds skills from repeated patterns
- `[2026-04-08]` **Multi-level memory**: session memory + persistent memory + skill memory (patterns across sessions)
- `[2026-04-08]` Recalls conversations from weeks ago when making current decisions — cross-session context
- `[2026-04-08]` When Hermes solves a hard problem, it writes a reusable skill doc — compounding asset
- `[2026-04-08]` **Zero data collection / zero telemetry** — all data local; MIT license
- `[2026-04-08]` Supports 200+ models via OpenRouter / Anthropic / OpenAI / custom
- `[2026-04-08]` Deploy: local, VPS, Docker, SSH, serverless (Modal, Daytona)
- `[2026-04-08]` **Profiles** = fully isolated envs with separate config/SOUL.md/memory/sessions/skills
- `[2026-04-08]` Migration from OpenClaw: `hermes claw migrate`
- `[2026-04-08]` Zero agent CVEs

**What Tinker borrows**: self-improvement loop concept (memory pipeline builds from observed activity), profile isolation pattern.

### Claude Cowork (Anthropic, closed source)
- `[2026-04-07]` Anthropic's in-house harness shipping with Claude Desktop
- `[2026-04-08]` Referenced as canonical reference implementation that OpenClaw/Hermes are open-source alternatives to
- `[2026-04-08]` Built on **Claude Agent SDK** (same as Glass)

**What Tinker differs on**: Tinker is the Cowork equivalent for OpenCode's world — and goes further by adopting Glass-level org features.

### Ramp Glass (closed source, internal)
- See [[ramp-glass]] for full deep-dive
- `[2026-04-10]` Built on **Claude Agent SDK**; Tinker parallel = OpenCode SDK

### Other Harnesses
- **Cline, Cursor, OpenCode** — accept SOUL.md-style system prompts for personality but lack full multi-agent/cron/memory systems
- **OpenCode** specifically is the foundation Tinker builds on (not a competitor)

## Shared Pattern: SOUL.md + Anti-AI-Slop Voice

- `[2026-04-04]` Meta Alchemist published an anti-AI-slop voice template for SOUL.md — grounds agents in concrete language, burstiness, theory of mind, stable character
- `[2026-04-04]` **Banned phrases** include: "delve," "crucial," "landscape," "leverage," "robust," "streamline," "notably," "unpack," "game-changer," "deep dive," "synergy," "holistic," "navigate," "nuanced," "empower," "foster," "paradigm," "ecosystem," "unlock," "journey," "optimize," "utilize," "facilitate," "implement," "in conclusion," "furthermore," "additionally"
- `[2026-04-04]` Science: AI text fails on low perplexity, low burstiness, absent emotional calibration, no theory of mind, no persistent character
- `[2026-04-04]` Three-layer SOUL.md: humanized writer voice + emotional state detection + personality engine

**Relevance to Tinker**: if Tinker ships default personality profiles, crib from this template.

## Anthropic OAuth Ban (April 2026) — Context

- `[2026-04-04]` **Anthropic banned subscription OAuth tokens across every third-party harness**, including OpenClaw and Hermes
- `[2026-04-04]` Using OpenClaw with Claude API directly is 20-30× more expensive than on a subscription
- `[2026-04-04]` Triggered the alternatives guide: GLM 5.1 (Z.ai), Minimax 2.7, OpenAI Codex (GPT-5.4), local models (Gemma 4, Qwen 3.5, Kimi 2.5)
- `[2026-04-08]` **Gemma 4 + OpenClaw + Ollama** = popular local stack — 24/7 free agents on M4 Mac Mini

**Relevance to Tinker**: OpenCode SDK + Codex OAuth (GPT-5.4) avoids the Anthropic ecosystem entirely. This is a strategic advantage — Tinker users aren't exposed to Anthropic policy changes.

## Related Tools and Add-ons

- **ClawHub** — OpenClaw community skill marketplace (44K+ skills) → Tinker analog is [[02-dojo-skill-marketplace]]
- **clawchief** (Ryan Carson) — OpenClaw-based EA stack with priority-map.md, auto-resolver.md, tasks.md, HEARTBEAT.md, cron jobs
- **awesome-design-md** (VoltAgent) — 31 DESIGN.md files from Stripe, Vercel, Notion, Linear, Apple
- **agentmemory** (rohitg00) — open-source Karpathy LLM wiki pattern
- **agent-browser** (Vercel Labs) — CLI tool giving agents real browser control; 82% fewer tokens than Playwright MCP

## Connections
- [[ramp-glass]]
- [[claude-cowork]]
- [[vision]]
- [[feature-gap-table]]
