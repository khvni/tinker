# Ramp Glass (clone)

A 1:1 clone of Ramp's internal AI productivity suite, **Glass**, as described in the public engineering post *"We Built Every Employee at Ramp Their Own AI Coworker."*

## Read these first

| File | What |
|---|---|
| `ramp-glass-prd.md` | The PRD — source of truth for *what* to build. |
| `CLAUDE.md` / `AGENTS.md` | Identical build guides — source of truth for *how* to build. |
| `tasks/README.md` | How to dispatch the parallel Conductor worktrees. |
| `.conductor/README.md` | How the repo plugs into Conductor. |

## Layout

```
ramp-glass/
├── apps/
│   ├── desktop/              Electron + React + FlexLayout workspace shell
│   ├── dojo-web/             Next.js on Vercel (W6 — skill index + Sensei)
│   └── mobile-approvals/     Minimal approve-from-phone surface (W7)
├── packages/
│   ├── shared-types/         FROZEN — contracts every agent codes against
│   ├── agent-runtime/        W1 — Claude Agent SDK wrapper
│   ├── memory/               W2 — SQLite + vector memory, 24h synthesis
│   ├── skills/               W3 — markdown skill loader, Dojo pane
│   ├── integrations/         W4 — MCP clients for 11 tools with self-heal
│   ├── auth/                 W5 — Okta OIDC + keychain vault
│   ├── scheduler/            W7 — cron + headless + mobile approvals
│   └── slack-bot/            W8 — assistants + triage
├── dojo/skills/              Git-backed markdown skill library (3 seed skills)
├── tasks/                    Per-worktree Conductor briefs
└── .conductor/               conductor.json + setup/run scripts
```

## Status

Wave 0 (scaffolding) is committed. The foundation task `tasks/foundation.md` (F0) still needs to run — it finishes CI, generates the lockfile, and freezes `shared-types`. After F0 merges, dispatch the six Wave-1 agents via Conductor.

## The three principles

From the source article, they govern every decision:

1. **Don't limit anyone's upside.** Make complexity invisible, don't remove it.
2. **One person's breakthrough becomes everyone's baseline.** Workflows compound via shared skills.
3. **The product is the enablement.** The UX teaches users faster than any training can.

## Remote

`origin` is [github.com/khvni/ramp-glass](https://github.com/khvni/ramp-glass). Push to `main` regularly.
