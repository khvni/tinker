# Tinker Documentation

Public documentation for Tinker — a local-first desktop AI workspace. Authoritative source for how the system works.

> **Looking for the spec?** See [`tinker-prd.md`](../tinker-prd.md) for the product requirements doc.
>
> **Contributing?** See [`../CLAUDE.md`](../CLAUDE.md) / [`../AGENTS.md`](../AGENTS.md) for build guide.
>
> **Agent-facing knowledge base?** That lives in [`../agent-knowledge/`](../agent-knowledge/) — work-in-progress specs, session logs, and research. Content graduates here when it stabilizes.

---

## Contents

### For users
- **[Getting started](./getting-started.md)** — install, first-run, connecting tools *(coming soon)*
- **[Architecture overview](./architecture.md)** — how the pieces fit together *(coming soon)*

### For contributors
- **[Auth architecture](./auth-architecture.md)** — consumer OAuth flow, identity vs. integration layers, Better Auth rationale
- **[Enterprise fork guide](./enterprise-fork-guide.md)** — how any enterprise dev adapts Tinker to a single-tenant IdP (Entra ID, Okta, etc.)
- **[Architectural decisions](./decisions.md)** — decision log with reasoning

### For operators
- Distribution + signing *(coming soon)*
- Telemetry + logging *(coming soon)*

---

## Licensing

Tinker upstream is MIT-licensed. Enterprise forks are governed by the forking organization's licensing. Nothing in this upstream repo is tied to any specific company — all enterprise-specific features are TODOs for downstream forks to implement per the guides here.
