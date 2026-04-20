---
type: index
---

# Tinker Agent Knowledge

Shared, version-controlled brain for Tinker's coding agents. Lives in the repo. Every contributor's coding agent reads from it and writes back to it as work progresses.

> **Not the same as `docs/`.** `docs/` is public, human-authored project documentation (authoritative, stable). `agent-knowledge/` is agent-facing scratchpad, work-in-progress specs, session logs, and research. Content graduates from `agent-knowledge/features/` to `docs/` when it stabilizes.

## Why This Exists

`tinker-prd.md` specifies **what to build**. `CLAUDE.md` / `AGENTS.md` specify **how to build**. This folder holds **the research, reasoning, and decisions** behind those specs — the context that lets an agent make informed judgment calls instead of guessing.

Without a shared knowledge base, every contributor's agent starts cold, asks the same questions, re-discovers the same answers, and drifts away from the product vision. With one, intelligence compounds in the repo itself.

## How Agents Use It

1. **Before building any feature** → read `features/NN-*.md` for the matching feature spec, reasoning, and out-of-scope boundaries
2. **For product-level questions** ("why are we doing this?") → `product/vision.md` + `product/positioning.md`
3. **For reference implementations** ("how does Ramp Glass do this?") → `reference/ramp-glass.md`
4. **Before making architectural decisions** → `product/decisions.md` (what's explicitly out of scope)
5. **Starting a session** → read `context/tasks.md` (open work) and the 2–3 most recent `context/sessions/*.md` files for continuity
6. **Ending a session** → append a session summary to `context/sessions/YYYY-MM-DD-HHMM.md` so the next agent picks up cleanly
7. **Discovering something new** → update the relevant note or add a new one; the knowledge base is meant to grow

## How Human Contributors Use It

- **Skim `product/` first** to understand the project's intent before changing architecture
- **Update `context/tasks.md`** when you open or close a piece of work
- **Link PRs to specific `features/NN-*.md` files** so reviewers can verify scope alignment
- **Don't duplicate `tinker-prd.md`** — the PRD is canonical spec; this is supporting context

## Structure

```
agent-knowledge/
├── README.md                     # This file
├── context/                      # Session-level state (updated frequently)
│   ├── tasks.md                  # Open features + status + priorities
│   └── sessions/                 # Per-agent-session summaries (append-only)
│       └── YYYY-MM-DD-HHMM.md
├── product/                      # Stable project-level reasoning
│   ├── vision.md                 # What Tinker is and why
│   ├── positioning.md            # vs Cowork, vs Glass — the moat
│   └── decisions.md              # Architectural decisions (what NOT to do)
├── reference/                    # External reference implementations + research
│   ├── ramp-glass.md             # Glass deep-dive
│   ├── claude-cowork.md          # Cowork overview
│   ├── feature-gap-table.md      # Claude Code vs Cowork vs Glass vs Tinker
│   ├── ramp-ai-adoption.md       # Why Glass exists (org adoption playbook)
│   └── ai-agent-harnesses.md     # OpenClaw / Hermes / Cowork landscape
└── features/                     # Feature specs with reasoning
    ├── 01-sso-connector-layer.md
    ├── 02-dojo-skill-marketplace.md
    ├── 03-memory-pipeline.md
    ├── 04-native-scheduler.md
    ├── 05-sensei-skill-discovery.md
    ├── 06-subagent-orchestration.md
    ├── 07-workspace-persistence.md
    ├── 08-mcp-proxy-layer.md
    └── 09-design-system.md
```

## UI Discipline (non-negotiable)

- **All UI uses `@tinker/design`.** Every button is `<Button>`, every status chip is `<Badge>`, every tab strip is `<SegmentedControl>`, every on/off is `<Toggle>`, every single-line field is `<TextInput>` / `<SearchInput>`, every multi-line field is `<Textarea>`, every indicator dot is `<StatusDot>`. No hand-rolled equivalents.
- **All color/spacing/radius/font values come from CSS tokens** (`--color-*`, `--space-*`, `--radius-*`, `--font-*`) defined in `@tinker/design/styles/tokens.css`. No inline hex, no parallel palette, no alt font stacks.
- **Playground is canonical** — `apps/desktop/src/renderer/routes/design-system.tsx` (served at `?route=design-system`). Any primitive change must update the playground in the same PR.
- **See [[09-design-system]] and [[decisions]] D14/D15** for the full rule set before touching any UI file.

## Conventions

- **Frontmatter** — every note has `type:` (`concept`, `tool`, `organization`, `person`, or `index`)
- **Atomic bullets** — one fact per bullet, prefixed with `[YYYY-MM-DD]` ingestion date
- **Dense and scannable** — no narrative prose, no filler phrases, no emojis unless part of source material
- **Wikilinks** — `[[bare-filename]]` form (no paths); resolves anywhere in `agent-knowledge/`
- **No sensitive info** — this is public in the repo; no personal PII, no private company data, no secrets
- **Update timestamps** — when appending new facts, use today's date; don't rewrite old timestamps

## Bootstrap Guide (If This Folder Is Missing or Stale)

If you're a new contributor's agent and `agent-knowledge/` is missing, thin, or contradicts the current codebase:

1. **Read `tinker-prd.md` first** — it's canonical
2. **Read `CLAUDE.md` / `AGENTS.md`** — build principles
3. **Read repo `README.md`** — public-facing project intent
4. **Create `agent-knowledge/README.md`** from this template if absent
5. **Seed the three pillars before building**:
   - `product/vision.md` — mission, target user, tech foundation
   - `product/decisions.md` — empty log; add entries as you learn what's out of scope
   - `context/tasks.md` — list of open features from the PRD
6. **Add reference docs as you encounter them** — when an agent fetches an external article or reference, process it into `reference/*.md` per the conventions above
7. **Write session summaries** — every agent session should end with a `context/sessions/YYYY-MM-DD-HHMM.md` entry
8. **Don't let `agent-knowledge/` drift** — if something in the PRD changes, update `product/vision.md` in the same PR

## Update Discipline

- **When you decide something's out of scope** → add to `product/decisions.md` with a `[YYYY-MM-DD]` entry
- **When you finish a feature** → update its `features/NN-*.md` status + close the corresponding line in `context/tasks.md`
- **When you learn something non-obvious** that future contributors will need → add to the relevant `reference/*.md` or create a new one
- **Never delete** historical decisions or session summaries — append new entries that supersede old ones and note the supersession

## Provenance

Initial seed (April 2026) — research on Ramp Glass, Claude Cowork, OpenClaw, Hermes, and related systems. Feature framing derived from product conversations about positioning Tinker as open-source Glass. Contributors are expected to extend this base, not treat it as frozen.
