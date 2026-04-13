# Ramp Glass — Product Requirements Document (v2)

> **Mission:** Build a personal/enterprise-ready clone of Ramp's "Glass" AI productivity suite, true to the article's principles but adapted for our stack: **OpenCode as headless backend**, **Codex OAuth for flat-rate LLM access**, **Google OAuth SSO** (personal) with future Microsoft Entra ID support (enterprise), **Dockview workspace**, and **Obsidian-compatible vault as the knowledge base**.

> **Audience:** Coding agents (Claude Code, Codex, OpenCode). Single source of truth. Read end-to-end before touching code.

---

## 0. Guiding Principles (from the article, non-negotiable)

1. **Don't limit anyone's upside.** Make complexity invisible, don't remove it. Power users get full control; basic users never see it.
2. **One person's breakthrough becomes everyone's baseline.** (Deferred to v2 via Dojo, but the architecture must not preclude it.)
3. **The product is the enablement.** The product teaches by doing. First-run should deliver a useful result within minutes, not hours.

---

## 1. Product Summary

Glass is a **local-first Electron desktop app** that gives every user an AI workspace on day one. Under the hood it runs **OpenCode** (`anomalyco/opencode`, MIT) as a headless backend server, getting the full agent loop, 25+ built-in tools, Vercel AI SDK, Codex OAuth, and MCP support for free. Glass adds the workspace UI, persistent memory backed by an Obsidian-compatible vault, Google/Entra ID SSO with auto-configured integrations, and a split-pane layout that persists across sessions.

The user opens the app, signs in with Google (or Entra ID at work), and everything connects on day one. If nothing is connected, Glass still works as a capable coding agent.

**LLM access:** GPT-5.4 via Codex OAuth (flat-rate, no API billing). User can switch models per-chat (5.4-mini, 5.4-pro, etc.). No Anthropic API dependency.

---

## 2. v1 Feature Set

### 2.1 OpenCode Backend (bundled, invisible)

- **Bundled inside the Electron app** as a dependency. On launch, Glass calls `createOpencode()` from `@opencode-ai/sdk` — this starts the server AND returns a connected client in one call. The user never sees a terminal.
- Provides: agent loop, Vercel AI SDK, Codex OAuth, GitHub Copilot auth, model selection, 25+ tools (bash, file read/write/edit, grep, glob, web search, web fetch, LSP, etc.), MCP server support, session management.
- Glass interacts entirely through the `@opencode-ai/sdk` client. Key methods:
  - `client.session.create()` / `.prompt()` / `.abort()` / `.messages()` for chat.
  - `client.event.subscribe()` for SSE streaming (token deltas, tool calls, file writes).
  - `client.auth.set()` to forward SSO tokens so MCP servers can authenticate.
  - `client.config.providers()` for model listing.
  - `session.prompt({ body: { model: { providerID, modelID } } })` for per-chat model selection.
- **Model selector:** GPT-5.4 default. User can switch per-chat via a dropdown. Models fetched from `models.dev/api.json` (same as OpenCode). Supports GPT-5.4, 5.4-mini, 5.4-pro, 5.4-nano, and any future models.
- **Codex OAuth flow:** Embedded in an Electron BrowserWindow popup (not a terminal). Forked from OpenCode's `packages/opencode/src/plugin/codex.ts`. PKCE against `auth.openai.com`, rewrites requests to `chatgpt.com/backend-api/codex/responses`. Tokens stored locally.

### 2.2 SSO + Auto-Connected Integrations

- **v1: Google OAuth** ("Sign in with Google"). One click. After sign-in:
  - Gmail, Google Calendar, and Google Drive/Docs integrations are auto-configured as MCP servers using the Google OAuth token. No manual setup.
  - User identity (name, email, avatar) stored for memory attribution.
- **Future: Microsoft Entra ID** (config flag). After sign-in:
  - Teams, Outlook, SharePoint, OneDrive, Excel/PowerPoint/Word auto-configured via Microsoft Graph API.
  - Same SSO provider interface, different implementation.
- **Fallback:** if the user skips SSO, Glass still works as a coding agent with OpenCode's built-in tools. Integrations are just unavailable until they sign in.
- **SSO provider abstraction:** a `SSOProvider` interface so Google and Entra ID (and future providers) share 90% of the plumbing.

### 2.3 Integrations (via MCP servers)

Glass does NOT build integration clients from scratch. It configures MCP servers in `opencode.json` and OpenCode handles the rest.

**v1 integrations (Google SSO):**

| Integration | MCP approach |
|---|---|
| Gmail | Google API MCP server (read, search, draft) |
| Google Calendar | Google API MCP server (list events, create, RSVP) |
| Google Drive / Docs | Google API MCP server (search, read, create) |
| Obsidian vault | Local filesystem — OpenCode's built-in file tools, no MCP needed |

**Future integrations (Entra ID, v2):**

| Integration | MCP approach |
|---|---|
| Microsoft Teams | Microsoft Graph MCP server |
| Outlook | Microsoft Graph MCP server |
| SharePoint / OneDrive | Microsoft Graph MCP server |
| Excel / PowerPoint / Word | Microsoft Graph MCP server |
| Linear | Linear MCP server |

Adding a new integration = adding an MCP server entry to `opencode.json`. No code changes.

### 2.4 Memory + Obsidian Vault as Knowledge Base

- **First-launch setup (two options):**
  1. **Connect existing vault:** User points Glass to an existing Obsidian vault directory. Glass indexes it.
  2. **Create new vault:** Glass creates `~/Glass/knowledge/` (or user-chosen path) as a new vault. Memory files are written here as markdown. User can open this folder in Obsidian any time.
- **What goes in the vault:** entities (people, projects, documents, channels), relationship maps, session summaries, "what changed today" notes. All as markdown files with YAML frontmatter — fully auditable and editable by the user.
- **Under the hood:** SQLite + vector index for fast hybrid search (BM25 + embeddings). The vault is the source of truth; SQLite is the index.
- **Daily synthesis:** background job (every 24h) mines previous sessions and connected integrations, updates entities in the vault, writes a daily summary note.
- **Memory injection:** before each agent turn, top-k relevant entities are injected into the system prompt via the Glass bridge layer.
- **For basic users:** memory is invisible — Glass just "knows" their stuff. For power users: the vault is right there on disk, editable in Obsidian or any text editor.

### 2.5 Workspace UI ("a workspace, not a chat window")

- **Dockview** split-pane layout (replaces FlexLayout from v1 PRD). v5, zero deps, React 19 compatible.
- **Split panes:** tile multiple chat sessions side by side, or alongside files, markdown, and data.
- **Drag tabs** between pane groups. Split horizontal or vertical.
- **Inline renderers** as tabs:
  - **Markdown** — rendered view + edit mode (toggle). Covers vault notes.
  - **CSV** — parsed into a scrollable table.
  - **Code** — syntax-highlighted (Monaco, read-only by default, editable on click).
  - **Images** — standard rendering.
  - **HTML** — sanitized via DOMPurify, rendered in sandboxed iframe.
- **Auto-open on file write:** when the agent writes or edits a file, it opens as a tab.
- **Persistent layout:** Dockview model serialized to SQLite on every change. Next-day launch is identical.
- **Keyboard shortcuts:** `Cmd+\` split vertical, `Cmd+Shift+\` split horizontal, `Cmd+W` close tab, `Cmd+Shift+]`/`[` next/prev tab. Standard, not vim.
- **Dark mode** default. Inter font.
- **First-run layout:** Chat pane (60%) + Today pane (40%) showing recent memory entities.

### 2.6 Scheduled Automations (deferred — revisit later)

Architecture must support it (the OpenCode server can receive messages on a cron), but no UI or implementation in v1.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Glass Desktop (Electron)                 │
│              React 19 + Dockview + Tailwind                │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │  Chat panes  │ │    Today     │ │  File / MD   │         │
│  │  (streaming) │ │  (memory)    │ │  renderers   │         │
│  └───────┬──────┘ └──────┬───────┘ └──────┬───────┘         │
│          │               │                │                │
│  ┌───────┴───────────────┴────────────────┴──────┐          │
│  │              Glass Bridge Layer                │          │
│  │  @opencode-ai/sdk client + memory injection   │          │
│  │  + vault indexing + layout persistence         │          │
│  └───────────────────┬───────────────────────────┘          │
│                      │                                     │
│  ┌───────────────────┴───────────────────────────┐          │
│  │          SSO Layer (Google / Entra ID)          │         │
│  └────────────────────────────────────────────────┘          │
└──────────────────────┼──────────────────────────────────────┘
                       │ HTTP + SSE (localhost)
┌──────────────────────┼──────────────────────────────────────┐
│         OpenCode Server (bundled, spawned by Electron)      │
│                                                             │
│  Vercel AI SDK · Codex OAuth · Agent loop · 25+ tools       │
│  Model selection · MCP servers · Session management         │
└──────────────────────┼──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
     ┌────┴────┐  ┌────┴────┐ ┌────┴────────┐
     │ OpenAI  │  │ Google  │ │  MS Graph   │
     │ (Codex  │  │  MCP    │ │  MCP (v2)   │
     │  OAuth) │  │ servers │ │             │
     └─────────┘  └─────────┘ └─────────────┘
```

### 3.1 Components

| Component | Technology | Responsibility |
|---|---|---|
| Desktop shell | **Electron** + `electron-builder` | Native windowing, child process lifecycle, OS keychain, auto-update |
| UI | **React 19 + Vite + Tailwind** | All panes, settings, onboarding |
| Workspace layout | **Dockview** (`dockview-react`) | Split panes, drag tabs, serialization |
| Renderers | `react-markdown`, Monaco, `papaparse`, DOMPurify | Inline markdown/CSV/code/image/HTML |
| Agent backend | **OpenCode** (bundled, `opencode serve`) | Agent loop, tools, LLM calls, MCP |
| Bridge | `@opencode-ai/sdk` + custom wrapper | Session management, memory injection, stream relay |
| LLM provider | **Codex OAuth** (via OpenCode's codex plugin) | GPT-5.4 family, flat-rate subscription |
| SSO | **Google OAuth** (`google-auth-library`) / **MSAL** (`@azure/msal-node`, v2) | Identity + integration auto-config |
| Memory | **SQLite** (`better-sqlite3`) + vector index | Entity store, relationship graph, hybrid search |
| Knowledge base | **Obsidian-compatible vault** (local markdown folder) | Human-readable memory, auditable, editable |
| Integrations | **MCP servers** configured in `opencode.json` | Gmail, Calendar, Drive (v1); Graph (v2) |

### 3.2 Data model

```ts
// Memory (in packages/memory)
type Entity = {
  id: string;
  kind: 'person' | 'project' | 'document' | 'channel' | 'ticket' | 'account' | 'other';
  name: string;
  aliases: string[];
  sources: Array<{ integration: string; externalId: string; url?: string }>;
  attributes: Record<string, unknown>;
  lastSeenAt: string;
};

type Relationship = {
  subjectId: string;
  predicate: string;
  objectId: string;
  confidence: number;
  source: string;
};

// SSO
type SSOProvider = 'google' | 'entra-id';

type SSOSession = {
  provider: SSOProvider;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
};

// Vault
type VaultConfig = {
  path: string;
  isNew: boolean;
};

// Layout
type LayoutState = {
  version: 1;
  dockviewModel: unknown; // Dockview's serialized JSON
  updatedAt: string;
};
```

### 3.3 Runtime flows

**a) First launch**
1. Glass opens → calls `createOpencode()` from `@opencode-ai/sdk` (starts server + returns client).
2. SSO screen: "Sign in with Google" (or "Sign in with Microsoft" if configured).
3. On Google sign-in: OAuth popup → tokens stored in OS keychain → Glass calls `client.auth.set()` to forward Google tokens to OpenCode → MCP servers (Gmail/Calendar/Drive) can now authenticate automatically.
4. Vault setup: "Connect existing Obsidian vault" or "Create new knowledge base at ~/Glass/knowledge/".
5. Codex OAuth: popup for LLM access → "Sign in with ChatGPT" → tokens stored by OpenCode.
7. Memory bootstrap: index the vault + pull initial data from connected Google apps → populate entities.
8. Workspace opens: Chat (60%) + Today (40%) with memory entities.

**b) Sending a message**
1. User types in Chat pane.
2. Glass Bridge injects top-k memory entities via `session.prompt({ body: { noReply: true, parts: [memoryContext] } })`.
3. Bridge sends the user message via `session.prompt({ body: { model: { providerID, modelID }, parts: [{ type: "text", text }] } })`.
4. OpenCode runs the agent turn (Vercel AI SDK + GPT-5.4 + tools).
5. `client.event.subscribe()` streams events back → Glass renders token deltas in Chat pane.
6. Tool calls (file writes, web fetches, etc.) execute on the server; results stream back.
7. Any `file_written` event auto-opens the file as a tab.
8. Post-turn: Bridge extracts new entities from `session.messages()` and updates memory + vault.

**c) Daily synthesis (background, every 24h)**
1. Iterate sessions from last 24h → summarize → extract entities.
2. Pull deltas from connected integrations (new emails, calendar events, etc.).
3. Update vault markdown files + SQLite index.
4. Write a `daily-summary-YYYY-MM-DD.md` note to the vault.

---

## 4. Repo Layout

```
ramp-glass/
├── apps/
│   └── desktop/                 # Electron + React + Dockview (THE product)
│       ├── src/
│       │   ├── main/            # Electron main process
│       │   │   ├── index.ts     # App lifecycle
│       │   │   ├── opencode.ts  # Spawn + manage opencode serve
│       │   │   ├── sso.ts       # Google OAuth / Entra ID popup
│       │   │   └── vault.ts     # Vault setup + watcher
│       │   ├── preload/
│       │   │   └── index.ts     # contextBridge
│       │   └── renderer/
│       │       ├── main.tsx
│       │       ├── App.tsx
│       │       ├── workspace/
│       │       │   ├── Workspace.tsx   # Dockview root
│       │       │   ├── pane-registry.ts
│       │       │   └── layout.default.ts
│       │       ├── panes/
│       │       │   ├── Chat.tsx
│       │       │   ├── Today.tsx
│       │       │   ├── Settings.tsx
│       │       │   └── MarkdownEditor.tsx
│       │       ├── renderers/
│       │       │   ├── MarkdownRenderer.tsx
│       │       │   ├── CsvRenderer.tsx
│       │       │   ├── CodeRenderer.tsx
│       │       │   ├── ImageRenderer.tsx
│       │       │   └── HtmlRenderer.tsx
│       │       └── styles.css
│       ├── package.json
│       └── electron-builder.yml
├── packages/
│   ├── shared-types/            # Slimmed types
│   ├── glass-bridge/            # @opencode-ai/sdk wrapper + memory injection
│   └── memory/                  # SQLite + vector + vault indexer
├── opencode.json                # MCP server config for integrations
├── .conductor/                  # Conductor setup
├── tasks/                       # Per-agent briefs
├── ramp-glass-prd.md
├── CLAUDE.md
├── AGENTS.md
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. Build Sequence

### Phase 0 — Foundation (serial)
1. Set up pnpm workspace with OpenCode as bundled dep.
2. Verify `opencode serve` can be spawned from Electron's main process and responds to SDK calls.
3. Configure `opencode.json` with placeholder MCP entries.
4. Freeze `packages/shared-types`.
5. Commit.

### Phase 1 — Parallel (4 agents)
| Agent | Scope | Deliverable |
|---|---|---|
| W1: Glass Bridge + Chat | `packages/glass-bridge`, `panes/Chat.tsx` | User types → GPT-5.4 streams a response. Model selector works. |
| W2: Memory + Vault | `packages/memory`, `panes/Today.tsx`, `main/vault.ts` | Vault indexer populates entities. Today pane shows them. Daily synthesis stub. |
| W3: Workspace + Renderers | `workspace/*`, `renderers/*` | Dockview layout persists. All 5 inline renderers work. Auto-open on file write. |
| W4: SSO + First-Run | `main/sso.ts`, `panes/Settings.tsx` | Google OAuth popup → tokens stored → integrations auto-configured → first-run wizard. |

### Phase 2 — Polish
| Agent | Scope | Deliverable |
|---|---|---|
| W5: Markdown editor pane | `panes/MarkdownEditor.tsx` | View + edit vault notes inline. Toggle rendered/source. |
| W6: E2E + smoke tests | `tests/e2e/` | First-run flow, send a message, layout persistence, vault indexing. |

---

## 6. Quality Bars

- **First-run: open → SSO → first useful response in under 5 minutes.**
- **"It just works":** sign in with Google and Gmail/Calendar/Drive are live. No config.
- **Errors are never the user's fault.** Self-heal on integration failures. "Glass is reconnecting…", never a stack trace.
- **Layout persists perfectly** across restarts.
- **Vault is always auditable.** User can open `~/Glass/knowledge/` in Finder/Obsidian and see clean markdown files.
- **Works offline** (except LLM calls). Memory, vault, and layout are fully local.

---

## 7. Non-Goals (v1)

- **Dojo / skills marketplace / Sensei** — deferred to v2. Architecture doesn't preclude it.
- **Slack assistants** — deferred.
- **Scheduled automations** — deferred (architecture supports it).
- **Microsoft Graph integrations** — deferred to the Keysight work fork.
- **Cloud sync** — local-first only.
- **Mobile app** — desktop only.
- **Non-GPT models** — Codex OAuth is the LLM path. No Anthropic API in v1.
- **Skills / prompts library** — deferred with Dojo.
- **Issue triage bot** — deferred with Slack.
- **TUI mode** — Glass is a GUI. Non-technical users must never see a terminal.

---

## 8. Glossary

- **Glass** — the product (Electron desktop app).
- **OpenCode** — the headless backend (agent loop, tools, LLM, MCP). Bundled inside Glass.
- **Glass Bridge** — the wrapper layer between Glass UI and OpenCode server.
- **Vault** — the Obsidian-compatible markdown folder that stores the user's knowledge base / memory.
- **Dojo** — the shared skills marketplace (v2).
- **Sensei** — the AI recommender inside Dojo (v2).
- **Harness** — the scaffolding around the model. Glass IS the harness.

---

## 9. Fidelity Checklist

Map each article claim to a shipped v1 capability:

- [ ] First-run onboarding assumes the user is NOT technical.
- [ ] SSO one-click setup (Google OAuth). (§2.2)
- [ ] Integrations auto-configured from SSO — no manual setup. (§2.2, §2.3)
- [ ] Memory bootstrap on first launch from vault + connected apps. (§2.4)
- [ ] 24-hour synthesis pipeline updates the vault. (§2.4)
- [ ] Split-pane workspace, drag tabs, split H/V. (§2.5)
- [ ] Inline rendering: markdown (editable), CSV, code, images, HTML. (§2.5)
- [ ] Auto-open on file write. (§2.5)
- [ ] Persistent layout across sessions. (§2.5)
- [ ] Model selector (GPT-5.4 / mini / pro). (§2.1)
- [ ] Codex OAuth — no API billing, flat-rate subscription. (§2.1)
- [ ] Vault is auditable markdown on disk. (§2.4)
- [ ] Works as a coding agent even without SSO. (§2.2 fallback)
- [ ] Self-healing integrations — errors never surface as stack traces. (§6)
- [ ] Dark mode, Inter font, standard keyboard shortcuts. (§2.5)
