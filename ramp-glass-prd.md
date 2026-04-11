# Ramp Glass — Product Requirements Document

> **Mission:** Build a 1:1 clone of Ramp's internal "Glass" AI productivity suite as described in the public engineering post *"We Built Every Employee at Ramp Their Own AI Coworker."* Every feature, architectural decision, and design principle in this PRD is drawn directly from that article. Do not invent features that are not in the article. Do not omit features that are.

> **Audience:** Autonomous coding agents (Claude Code, OpenAI Codex, OpenCode). This PRD is the single source of truth. Read it end-to-end before touching code.

---

## 0. Guiding Principles (from the article, non-negotiable)

These three principles **must** shape every technical and product decision. If a feature fights these principles, the feature is wrong.

1. **Don't limit anyone's upside.** No "dumbed-down mode." Power-user capability (multi-window workflows, deep integrations, scheduled automations, persistent memory, reusable skills) must be preserved in full. The goal is to make complexity *invisible*, not to remove it.
2. **One person's breakthrough becomes everyone's baseline.** Every workflow, skill, or insight one user discovers must be shareable so the whole org levels up. The floor rises; the ceiling does not fall.
3. **The product is the enablement.** The product itself teaches people to be AI power-users by suggesting the right skill at the right time and showing what "good" looks like in the moment. No workshops required.

---

## 1. Product Summary

Glass is a **local-first, desktop-based AI workspace** that turns every employee into an AI power-user on day one. It auto-configures on install via Okta SSO, ships a shared marketplace of reusable skills ("Dojo"), builds a persistent cross-session memory of the user's world, runs scheduled background automations, hosts Slack-native assistants, supports headless long-running tasks approvable from mobile, and presents the entire experience in a tiled, code-editor-style workspace.

The underlying agent is **Claude** (Anthropic). Glass is the *harness* — the article's explicit framing: "The models are good enough, the harness isn't."

---

## 2. Core Feature Set (1:1 from the article)

Each feature below is load-bearing. None are optional for v1.

### 2.1 Auto-Configured Install ("Everything connects on day one")

- **Single sign-on via Okta.** User signs in once; all org tools become available with a **one-click setup**.
- **Pre-wired integrations** (first-party + home-grown):
  - Slack
  - Notion
  - Linear
  - Salesforce
  - Gong
  - Snowflake
  - Zendesk
  - Google Calendar (and analogous calendar)
  - **Ramp-built tools** the article names explicitly: **Ramp Research**, **Ramp Inspect**, **Ramp CLI**. In this clone, expose these as placeholder integration slots with the same UX contract so they can be wired to real or mock backends.
- **"It just works" guarantee:** when a user says *"pull context from a Gong call, enrich with Salesforce, draft a follow-up,"* no configuration should be required — integrations are live from first launch.
- **Self-healing integrations.** If a connection breaks, Glass detects and repairs (or re-auths) without blaming the user. The article: *"errors aren't your fault — the system has your back."*

### 2.2 Dojo — Shared Skills Marketplace

- **Skills are markdown files** that teach the agent exactly how to perform a specific task. (Same format/spirit as Claude Code / Agent SDK skills.)
- **Dojo is the marketplace** that hosts, distributes, and versions them.
- **Git-backed, versioned, reviewed like code.** Skills live in a git repository; changes go through code review.
- **Install-to-use.** A skill discovered in Dojo can be installed with one action and is immediately usable by the user's agent.
- **Authoring flow.** Any user can package a workflow as a skill and publish it to Dojo. The article cites examples:
  - A sales rep packages "analyze Gong calls → break down competitive mentions → draft battlecards."
  - A CX engineer packages "Zendesk investigation: pull ticket history → check account health → suggest resolutions."
- **Scale target:** system must comfortably host and search **350+ skills** (the article's cited count).
- **Organization-wide sharing.** Publishing a skill makes it available to every employee. A skill published by one CX lead must be able to "level up" 60+ reps overnight.

### 2.3 Sensei — Dojo's AI Guide

Built into Dojo. A recommender that surfaces the right skills at the right moment.

- **Inputs:**
  - Which tools/integrations the user has connected.
  - The user's role.
  - What they've recently been working on (session history + memory).
- **Output:** a short, ranked list of skills most likely to be useful — specifically optimized so a new hire does **not** have to browse a catalog of hundreds. The article: *"The Sensei surfaces the five that matter most on day one."*
- **Mechanism:** the Sensei is itself an agent running against a Dojo index + user context. In implementation terms it is a small Claude-powered recommender with access to `dojo.search`, `user.profile`, and `memory.recent`.

### 2.4 Memory System ("Remembers who you are and what you're working on")

- **First-launch bootstrap.** On first open, Glass reads the user's authenticated connections and builds a **full memory** of their world:
  - People they work with.
  - Active projects.
  - References to relevant Slack channels, Notion documents, Linear tickets, etc.
- **Every session starts pre-loaded with this context.** Agents spend less time searching — they enter each chat already knowing the user's world.
- **Daily synthesis & cleanup pipeline.** Every 24 hours a background job mines:
  - The user's previous Glass sessions.
  - Connected tools (Slack, Notion, Calendar, etc.).
  - Any other authenticated integrations.
  
  …and updates memory so Glass adapts to the user's world **without them having to re-explain things every session**.
- **Memory is per-user and persistent** across sessions, restarts, and devices signed into the same identity.

### 2.5 Scheduled Automations ("It works while you don't")

- **Laptop-as-server model.** The article is explicit: *"Glass turns your laptop into a server."* Automations run on the user's machine.
- **Scheduling surface:**
  - Daily.
  - Weekly.
  - Custom cron expressions.
- **Slack-native output.** Results of an automation can post directly to a Slack channel.
- **Setup time must be minutes, not hours.** Example from the article: *a finance lead pulls yesterday's spend anomalies every morning at 8am and posts a summary, set up in a few minutes with a simple prompt.*
- **Configured via prompt, not a form.** The user describes the job in natural language; Glass produces the schedule + action.

### 2.6 Slack-Native Assistants

- Users can create **assistants that live inside Slack channels**, listen, and respond using the user's full Glass setup:
  - Their integrations.
  - Their memory.
  - Their skills.
- Must be creatable **in an afternoon**, per the article's ops-team vendor-policy-bot example.
- The assistant answers by pulling from connected sources (e.g., Notion docs + Snowflake data).

### 2.7 Headless Mode & Mobile Approvals

- **Headless long-running tasks.** Kick a task off, close the laptop lid, walk away. Results are waiting on return.
- **Mobile permission approvals.** When a running task needs permission (tool use, destructive action, credential access), the user can approve from their phone.
- Implied: a lightweight mobile companion surface (push notifications + an approve/deny UI). Scope for v1: a minimal mobile web surface reachable via short-lived URL is sufficient if native apps are out of budget — but the approve-from-phone flow must work end-to-end.

### 2.8 Workspace UI ("A workspace, not a chat window")

This is the single biggest visual / UX differentiator. Treat it as first-class.

- **Code-editor-inspired layout.** Not a single conversation thread. A full workspace.
- **Split panes.** Tile multiple chat sessions side by side. Open documents, data files, and code alongside conversations.
- **Drag to rearrange tabs.**
- **Split horizontally or vertically.**
- **Keep context visible while you work.** No forced context switching.
- **Inline rendering** as tabs for:
  - Markdown
  - HTML
  - CSV
  - Images
  - Code with syntax highlighting
- **Auto-open on file write.** When Claude (the agent) creates or edits a file, the file opens automatically in a tab.
- **Persistent layout.** When the user returns the next day, panes, tabs, and state are **exactly** as they left them.

### 2.9 Issue Triage / Feedback Loop (operational feature)

The article highlights this as part of Glass's advantage:

- A dedicated Slack channel where users report issues.
- A triage agent that **automatically converts reports into tickets**.
- Most issues resolved in **hours, not sprints**.

Build this in from v1: an internal `#glass-help`-style channel listener, an LLM-powered triager, and a minimal ticket store. This is dogfooding infrastructure and must exist from day one.

---

## 3. Architecture

The article does not name specific libraries, so the following choices are the minimum viable stack that honors every stated constraint. Deviate only with strong reason.

### 3.1 High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│                     Glass Desktop App                      │
│              (Electron + React/TypeScript)                  │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Workspace UI │ │    Dojo UI   │ │  Settings /  │         │
│  │ (split panes)│ │   + Sensei   │ │  Integrations│         │
│  └───────┬──────┘ └──────┬───────┘ └──────┬───────┘         │
│          │               │                │                │
│  ┌───────┴───────────────┴────────────────┴──────┐          │
│  │           Glass Local Agent Runtime           │          │
│  │  (Node.js + Claude Agent SDK + MCP clients)   │          │
│  └───────┬───────────────┬────────────────┬──────┘          │
│          │               │                │                │
│  ┌───────┴──────┐ ┌──────┴──────┐ ┌───────┴──────┐          │
│  │   Memory     │ │   Skills    │ │  Scheduler   │          │
│  │  (SQLite +   │ │ (git-backed │ │  (cron +     │          │
│  │   vector db) │ │  markdown)  │ │ headless run)│          │
│  └──────────────┘ └─────────────┘ └──────────────┘          │
└─────────────────────────────────────────────────────────────┘
                        │          │         │
                 ┌──────┴───┐ ┌────┴────┐ ┌───┴──────┐
                 │   Okta   │ │ Claude  │ │  Dojo    │
                 │   SSO    │ │   API   │ │ Registry │
                 └──────────┘ └─────────┘ └──────────┘
                                              │
                                    ┌─────────┴──────────┐
                                    │  Git repo hosting  │
                                    │  skills (GitHub)   │
                                    └────────────────────┘
```

### 3.2 Components

| Component | Technology (baseline) | Responsibility |
|---|---|---|
| Desktop shell | **Electron** (`electron` + `electron-builder`) | Native windowing, auto-update, laptop-as-server lifecycle, OS integration |
| UI framework | **React 19 + TypeScript** + **Vite** | Workspace, Dojo, Settings |
| Workspace layout | **FlexLayout** (`flexlayout-react`) or Dockview | Split panes, drag tabs, persistent layout |
| Renderers | `react-markdown`, `@uiw/react-md-editor`, `monaco-editor`, `papaparse`, `sandpack` for code previews | Markdown, HTML, CSV, images, syntax-highlighted code |
| Agent runtime | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` / `claude-agent-sdk` Python), model `claude-sonnet-4-6` by default with `claude-opus-4-6` for heavy tasks | Drives tool use, skills, subagents |
| LLM provider | **Anthropic Claude API** (default to latest Sonnet 4.6) | Core intelligence |
| Integrations | **Model Context Protocol (MCP)** servers for each external tool | Slack, Notion, Linear, Salesforce, Gong, Snowflake, Zendesk, Calendar, Ramp Research/Inspect/CLI |
| Auth | **Okta OIDC** via `openid-client`; token vault in OS keychain (`keytar`) | SSO + per-integration tokens |
| Memory store | **SQLite** (`better-sqlite3`) + **LibSQL/Turso-compatible vector** *or* `sqlite-vss` for embeddings | Facts, entities, relationships, references, per-session history |
| Skills store | **Local git clone** of Dojo repo; watched with `chokidar`; each skill = a markdown file with YAML frontmatter | Versioned, reviewed, distributable |
| Scheduler | `node-cron` for cron; a headless Electron background window (or a detached Node process) for long-running tasks | Daily / weekly / custom automations |
| Slack bot runtime | **Bolt for JavaScript** (`@slack/bolt`) in Socket Mode | Slack-native assistants + triage listener |
| Mobile approvals | Short-lived signed URL served by a local tunnel (e.g., `cloudflared` quick tunnel) rendering a Tailwind approve/deny screen; push via Slack or APNs/FCM (Slack DM is acceptable for v1) | Approve permissions from phone |
| Dojo backend | **GitHub repo** `ramp-glass-dojo` acting as registry; a thin metadata index served from a Next.js (App Router) app on **Vercel** for search + Sensei | Marketplace + search + recommender endpoint |
| Sensei recommender | Claude call with structured output (`tool_use` or JSON mode) against the Dojo index + user context payload | Top-5 skill recommendations |
| Triage agent | A `@slack/bolt` listener → Claude classifier → GitHub Issues (`@octokit/rest`) in the Glass repo | Auto-ticketing |

### 3.3 Data model (minimum)

```ts
// Memory
type Entity = {
  id: string;
  kind: 'person' | 'project' | 'document' | 'channel' | 'ticket' | 'account' | 'other';
  name: string;
  aliases: string[];
  sources: Array<{ integration: string; externalId: string; url?: string }>;
  attributes: Record<string, unknown>;
  lastSeenAt: string; // ISO
};

type Relationship = {
  subjectId: string;
  predicate: 'works_with' | 'owns' | 'mentions' | 'related_to' | string;
  objectId: string;
  confidence: number;
  source: string;
};

type SessionRef = {
  sessionId: string;
  entityIds: string[];
  summary: string;
  createdAt: string;
};

// Skills
type SkillFrontmatter = {
  name: string;
  description: string;
  author: string;
  team?: string;
  tags: string[];
  version: string; // semver
  requires?: { integrations?: string[]; skills?: string[] };
};

type Skill = {
  path: string; // relative to dojo repo
  frontmatter: SkillFrontmatter;
  body: string; // markdown instructions for the agent
};

// Scheduled jobs
type ScheduledJob = {
  id: string;
  ownerUserId: string;
  prompt: string;                 // natural-language intent
  cron: string;                   // e.g. "0 8 * * *"
  output: { type: 'slack'; channel: string } | { type: 'workspace' };
  lastRunAt?: string;
  lastStatus?: 'success' | 'error';
};

// Slack assistants
type SlackAssistant = {
  id: string;
  ownerUserId: string;
  channelId: string;
  systemPrompt: string;
  skills: string[];               // skill ids from Dojo
  integrations: string[];         // mcp server ids
};

// Workspace layout (persisted)
type LayoutState = FlexLayoutJsonModel; // flexlayout-react model JSON
```

### 3.4 Runtime flows

**a) First launch**
1. User clicks Okta Sign in → OIDC code flow → tokens stored in OS keychain.
2. Glass discovers org integrations available to this user's identity (via Okta groups or a config file) and mints per-integration tokens.
3. Memory bootstrap job runs: pulls a bounded slice of Slack DMs, Calendar, Notion workspace index, Linear assignments → populates `Entity` + `Relationship` tables.
4. Sensei computes top-5 recommended skills and pins them on the Dojo home tab.
5. Workspace opens to a welcome layout: a chat pane, a Dojo pane, and a "Today" pane showing recent entities + scheduled jobs.

**b) Sending a message**
1. User types in a chat tab.
2. Agent runtime loads: user profile + top-k relevant memory entities + enabled skills + enabled MCP integrations.
3. Claude Agent SDK runs the turn with tool use; any created/edited files are surfaced as new tabs in the same split pane group.
4. After the turn, a short post-processor extracts new entities/relationships and upserts to memory.

**c) Daily synthesis (cron: `0 3 * * *` local time)**
1. Iterate sessions from last 24h → summarize → extract entities.
2. For each authenticated integration, pull its delta since the last run.
3. Reconcile entities, dedupe, decay old ones.
4. Write a short "what changed today" note to memory so the next session can surface it.

**d) Headless long-running task**
1. User invokes a task with `--headless` (UI: "Run in background").
2. A detached runner process takes the conversation state.
3. Any tool call requiring permission beyond an allow-list pauses the task and sends a **Slack DM with approve/deny buttons**, signed with a short TTL.
4. On approve, the runner resumes. On deny, the task aborts cleanly.
5. When complete, a notification fires and the full transcript is available in the workspace on next launch.

**e) Slack-native assistant**
1. User configures an assistant (channel, system prompt, skills, integrations).
2. A `@slack/bolt` handler is registered for that channel.
3. On each message, the assistant runs a Claude turn with the user's full Glass context (memory + skills + MCP) and replies in-thread.

---

## 4. File / Repo Layout

Monorepo. Single git root at the `ramp-glass` directory. No npm workspaces gymnastics unless needed; a flat pnpm workspace is fine.

```
ramp-glass/
├── apps/
│   ├── desktop/                 # Electron app (main + preload + renderer)
│   │   ├── src/
│   │   │   ├── main/            # Electron main process
│   │   │   ├── preload/         # contextBridge
│   │   │   └── renderer/        # React app (workspace, dojo, settings)
│   │   ├── electron-builder.yml
│   │   └── package.json
│   ├── dojo-web/                # Next.js App Router, deployed on Vercel
│   │   ├── app/
│   │   ├── lib/
│   │   └── package.json
│   └── mobile-approvals/        # Minimal React/Tailwind approve/deny page
├── packages/
│   ├── agent-runtime/           # Claude Agent SDK wrapper; tool registry; memory loader
│   ├── memory/                  # SQLite + vector store; entity/relationship schema
│   ├── skills/                  # Skill loader, frontmatter parser, git sync
│   ├── scheduler/               # node-cron wrapper + headless runner
│   ├── integrations/            # MCP clients for Slack, Notion, Linear, Salesforce, Gong, Snowflake, Zendesk, Calendar, Ramp Research/Inspect/CLI
│   ├── auth/                    # Okta OIDC + keychain token vault
│   ├── slack-bot/               # Bolt app for assistants + triage
│   └── shared-types/            # TypeScript types shared across packages
├── dojo/                        # Git submodule or sibling: the skill marketplace content
│   └── skills/
│       ├── sales/analyze-gong-competitive.md
│       ├── cx/zendesk-investigation.md
│       └── finance/daily-spend-anomalies.md
├── ramp-glass-prd.md            # THIS DOCUMENT
├── CLAUDE.md                    # Agent coding guide
├── AGENTS.md                    # Identical copy for non-Claude agents
├── README.md
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. Build Sequence (for the implementing agent)

Execute in this order. Each phase must compile, run, and be committed before moving on.

### Phase 1 — Skeleton
1. Initialize pnpm workspace; TypeScript 5.6+, strict mode everywhere.
2. Scaffold `apps/desktop` as Electron + Vite + React + Tailwind.
3. Add `packages/shared-types` with the data-model types from §3.3.
4. Render a placeholder workspace with FlexLayout: 3 tabs — `Chat`, `Dojo`, `Today`.
5. Commit.

### Phase 2 — Agent runtime + one integration
1. Add `packages/agent-runtime`. Wrap Claude Agent SDK. Hardcode model `claude-sonnet-4-6`.
2. Wire the `Chat` tab to the runtime. Streaming tokens into the pane.
3. Add `packages/integrations` with **one** MCP server (Slack) and a mock token.
4. Agent can send a Slack message. Commit.

### Phase 3 — Skills + Dojo
1. `packages/skills`: load markdown files from `dojo/skills/**` with YAML frontmatter; expose to the agent runtime as system-prompt snippets + callable skill names.
2. Seed 3 skills matching the article's examples:
   - `sales/analyze-gong-competitive.md`
   - `cx/zendesk-investigation.md`
   - `finance/daily-spend-anomalies.md`
3. Dojo tab in the UI: list installed skills, search box, install/uninstall toggles.
4. Commit.

### Phase 4 — Memory
1. `packages/memory`: SQLite schema from §3.3; embeddings via `@anthropic-ai/sdk` or OpenAI-compatible local model; hybrid search (BM25 + vector).
2. Bootstrap job: stub integrations return fake entities; verify the pipeline shape.
3. Agent runtime pre-loads top-k memory into each turn.
4. Commit.

### Phase 5 — Auth & real integrations
1. `packages/auth`: Okta OIDC code flow in Electron (via `openid-client`); store tokens with `keytar`.
2. Implement real MCP clients for the full integration list in §2.1. Ramp Research / Ramp Inspect / Ramp CLI are stubbed with the same MCP interface so they can be swapped later.
3. Self-healing: on 401/expired token, trigger re-auth inline without surfacing an error to the user.
4. Commit.

### Phase 6 — Sensei
1. `apps/dojo-web` on Next.js: a `GET /api/skills` index and `POST /api/sensei` recommender endpoint.
2. Recommender takes `{ connectedTools, role, recentEntities }` → Claude → returns top-5 skill IDs + short rationale.
3. Desktop app pins Sensei recommendations on the Dojo tab.
4. Commit and deploy dojo-web to Vercel.

### Phase 7 — Scheduler & headless
1. `packages/scheduler`: `node-cron` with jobs stored in SQLite.
2. UI: "Schedule this" button on any chat turn → natural language → parsed into a `ScheduledJob`.
3. Slack output adapter.
4. Headless runner: detached process; Slack DM approval flow for permissioned tool calls.
5. Commit.

### Phase 8 — Slack assistants + triage
1. `packages/slack-bot` with Bolt in Socket Mode.
2. Assistant registration UI in the desktop app.
3. Issue triage listener on a configurable `#glass-help` channel → Claude classifier → GitHub Issues via `@octokit/rest`.
4. Commit.

### Phase 9 — Workspace polish
1. Persistent layout: serialize FlexLayout model to SQLite on every change; restore on launch.
2. File auto-open: when the agent emits a file write tool call, create a new tab for the file in the same tab group.
3. Inline renderers: markdown, HTML (sanitized), CSV (PapaParse → table), images, syntax-highlighted code (Monaco).
4. Commit.

### Phase 10 — Mobile approvals
1. `apps/mobile-approvals`: a tiny Tailwind page served over a signed short-lived URL.
2. Hook into the headless runner's permission pause.
3. Commit.

---

## 6. Non-Negotiable Quality Bars

From the article's tone and explicit statements:

- **First-run must "just work."** A user who signs in for the first time must see their memory populated, Sensei recommendations pinned, and at least one working integration *before their first message*.
- **Skill install must be one action.** Clicking "Install" on a Dojo card installs the skill; the next chat turn can use it.
- **Scheduled-job setup must take minutes.** A finance lead describing *"every morning at 8am, pull yesterday's spend anomalies and post a summary to #fin-ops"* must go from prompt → live job in under 5 minutes of real-wall-clock time.
- **Issue reports must triage automatically.** Posting in `#glass-help` must produce a tracked ticket with no human intervention.
- **Errors are never the user's fault.** All integration errors self-heal or surface as "Glass is reconnecting…", never as a stack trace.
- **Layout persists perfectly.** Next-day launch restores panes, tabs, and state byte-for-byte.

---

## 7. Explicit Non-Goals (v1)

Anything not in the article is out of scope. In particular:

- No "beginner mode" / simplified UI variant. (Principle 1.)
- No manual per-integration config wizard beyond the one-click SSO flow. (§2.1.)
- No in-app skill editor GUI — skills are markdown files reviewed via git, like code. (§2.2.)
- No non-Claude LLM backends in v1. The article's framing is Claude-specific.
- No team/admin console beyond what's needed for Okta SSO group-based integration provisioning.

---

## 8. Glossary

- **Glass** — the product.
- **Dojo** — the shared skills marketplace.
- **Sensei** — the AI recommender inside Dojo.
- **Skill** — a markdown file, git-versioned, that teaches the agent how to do one specific task.
- **Headless mode** — long-running agent task that continues after the user walks away.
- **Harness** — the scaffolding around the model (memory, skills, tools, UI). The article's thesis: the model is good enough; the harness isn't — Glass *is* the harness.

---

## 9. Source Fidelity Checklist

Before marking v1 done, verify each article claim maps to a shipped capability:

- [ ] 99%-adoption target context → first-run onboarding assumes the user is **not** technical.
- [ ] Okta SSO one-click setup. (§2.1)
- [ ] Pre-wired integrations including Ramp Research / Ramp Inspect / Ramp CLI slots. (§2.1)
- [ ] Dojo marketplace with git-backed, versioned, code-reviewed skills. (§2.2)
- [ ] Support for 350+ skills at scale. (§2.2)
- [ ] Sensei surfaces top-5 skills on day one. (§2.3)
- [ ] Memory bootstrap on first launch. (§2.4)
- [ ] 24-hour synthesis & cleanup pipeline. (§2.4)
- [ ] Daily / weekly / cron scheduling. (§2.5)
- [ ] Slack-channel output for scheduled jobs. (§2.5)
- [ ] Slack-native assistants with full Glass context. (§2.6)
- [ ] Headless long-running tasks. (§2.7)
- [ ] Approve permissions from phone. (§2.7)
- [ ] Split-pane workspace, drag tabs, split horizontal/vertical. (§2.8)
- [ ] Inline rendering: markdown, HTML, CSV, images, syntax-highlighted code. (§2.8)
- [ ] Auto-open on file write. (§2.8)
- [ ] Persistent layout across sessions. (§2.8)
- [ ] Slack-channel issue triage → auto tickets. (§2.9)
- [ ] Self-healing integrations. (§2.1, §5 of article on "What We Learned")

When every box is checked, the clone is faithful.
