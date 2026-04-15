---
type: concept
tags: [tinker, feature, subagents, orchestration, opencode]
status: not-started
priority: p2
---

# Feature 06 — Sub-Agent Orchestration

Orchestrator decomposes a complex request into sub-agent tasks. Workers pull from specific tools in parallel. Results compose back into a single answer.

## Goal

User says: "Draft a follow-up email for my meeting with the Acme team — pull the Gong call from last week, cross-reference the Linear ticket they filed, and find the CRM notes from our last check-in."

The orchestrator splits this into:
- Worker A: query Gong via MCP for the Acme call
- Worker B: query Linear for tickets tagged Acme
- Worker C: query CRM (MCP) for Acme contact notes

Workers run in parallel, return results to orchestrator, orchestrator composes the email draft.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` "When a sales rep asks Glass to pull context from a Gong call, enrich with Salesforce data, and draft a follow-up — it just works"
- `[2026-04-10]` Cowork (which Glass is built adjacent to) explicitly supports sub-agent coordination per Anthropic docs

## Tinker Scope

### v1 Scope
- `[2026-04-14]` Use **OpenCode SDK's sub-agent primitives** — don't reinvent orchestration
- `[2026-04-14]` Orchestrator session coordinates multiple worker sessions via OpenCode APIs
- `[2026-04-14]` Workers are scoped to specific tool subsets (e.g., worker A = Gmail + Calendar only)
- `[2026-04-14]` Token efficiency via **prompt caching** (OpenCode SDK supports) and **selective context passing** at the text level
- `[2026-04-14]` No Latent Briefing (see [[decisions]])

### v2 / later
- Dynamic worker spawning based on tool inventory
- Worker failure recovery / retry policies
- Visualization of orchestration graph in workspace (observability)

## Architecture

### OpenCode SDK primitives (per SDK docs at https://opencode.ai/docs/sdk/)

- `[2026-04-14]` `session.create()` — creates an isolated session (use one per worker)
- `[2026-04-14]` `session.prompt()` — sends a prompt
- `[2026-04-14]` `session.messages()` — retrieves results
- `[2026-04-14]` `event.subscribe()` — SSE event stream
- `[2026-04-14]` `auth.set()` — scopes credentials per session (enables tool-restricted workers)

### Orchestration pattern

```
Orchestrator session (main chat)
  ├── Worker session A — Gmail MCP only
  ├── Worker session B — Linear MCP only
  └── Worker session C — Calendar + Drive MCP only

Workers run in parallel.
Orchestrator reads worker outputs, composes final response.
```

### Context-passing strategy

- `[2026-04-14]` Orchestrator passes **minimal targeted context** to each worker — the specific question, not the full conversation
- `[2026-04-14]` Orchestrator decides what to pass back up — workers return structured outputs when possible
- `[2026-04-14]` Prompt caching (OpenCode supports) handles overlap in system prompts and shared context across worker calls

## Token Efficiency (without Latent Briefing)

Latent Briefing is explicitly rejected (see [[decisions]]). Achieve token efficiency via:

- `[2026-04-14]` **Prompt caching** — OpenCode SDK exposes cache control; reuse system prompts and stable context across workers
- `[2026-04-14]` **Selective context passing** — orchestrator passes only the question + the specific prior-turn output worker needs, not full trajectory
- `[2026-04-14]` **Structured worker outputs** — workers return JSON/bullet lists, not long prose; cheaper for orchestrator to reason over
- `[2026-04-14]` **Parallel execution** — wall-clock time is what the user feels, not total tokens

## Implementation Outline

### Package boundary
- `[2026-04-14]` **`packages/bridge`** — orchestration helpers on top of `@opencode-ai/sdk`
- `[2026-04-14]` **`packages/shared-types`** — orchestration event types for UI

### API sketch

```typescript
type WorkerSpec = {
  id: string;
  tools: string[];          // MCP server names this worker can access
  prompt: string;           // targeted question
};

type OrchestrationResult = {
  workers: Record<string, { output: string; tokensUsed: number }>;
  finalOutput: string;
};

export async function orchestrate(
  orchestratorPrompt: string,
  workers: WorkerSpec[]
): Promise<OrchestrationResult>;
```

### UI considerations

- `[2026-04-14]` Optional "show orchestration" toggle — renders a collapsed view of worker names + their outputs
- `[2026-04-14]` Default view hides orchestration — user just sees the final answer
- `[2026-04-14]` Per Tinker Principle 1: complexity invisible, not absent

## Out of Scope ([[decisions]])

- `[2026-04-14]` **Latent Briefing / KV cache compaction** — requires self-hosted model, violates nontechnical UX
- `[2026-04-14]` Dynamic worker spawning based on runtime inference — v1 workers are predefined per orchestration call

## Open Questions

- **Who decides worker decomposition**: orchestrator LLM (model decides) vs. user (explicit) vs. heuristic (tool inventory + prompt keywords). Leaning: orchestrator LLM via a structured decomposition prompt, fallback to single-session if no clear split.
- **Worker tool scoping**: OpenCode SDK supports this natively? Verify against SDK docs; if not, enforce via system-prompt instruction.
- **Failure handling**: if worker B fails, does orchestrator retry? Continue with partial results? Leaning continue with partial + surface to user.

## Open-Source References

- OpenCode SDK docs — https://opencode.ai/docs/sdk/
- Anthropic Cowork sub-agent docs (if public) — conceptual reference
- Recursive Language Model (RLM) framework (Zhang et al., 2025) — the academic framing of orchestrator + worker pattern

## Acceptance Criteria

- [ ] Orchestrator can spawn N worker sessions via OpenCode SDK
- [ ] Workers have scoped tool access (verified via MCP call attempts)
- [ ] Workers run in parallel (wall-clock time < sum of individual times)
- [ ] Final output composes worker results
- [ ] Token usage is reported per-worker in dev mode
- [ ] Failures in one worker don't crash the orchestration

## Connections
- [[decisions]] — why no Latent Briefing
- [[ramp-glass]] — orchestration reference
- [[claude-cowork]] — Cowork's sub-agent pattern
- [[01-sso-connector-layer]] — MCP integrations workers consume
