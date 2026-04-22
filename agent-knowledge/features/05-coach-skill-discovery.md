---
type: concept
tags: [tinker, feature, coach, skills, discovery, recommendation]
status: not-started
priority: p2
aliases: [sensei-skill-discovery]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** Depends on Playbook ([[02-playbook-skill-marketplace]]) which is also deferred. Do not start work until MVP ships.
>
> **[2026-04-21] Exception — `TIN-127` may land as a narrow unblocker slice.** User explicitly approved shipping the shared `RoleProfile` contract plus inference from MCP connections + skill-install history so future Coach work has a typed foundation. This does **not** reopen Coach UI, recommendations surfaces, or the broader Playbook dependency chain.

# Feature 05 — Coach Skill Discovery

Recommend the 5 skills that matter most to this user right now. Don't make them browse 350.

> Renamed `[2026-04-20]` from "Sensei" to "Coach". Same feature — the martial-arts loan was swapped for a sports-idiom frame (Coach recommends plays from the Playbook — see [[02-playbook-skill-marketplace]]). Ramp Glass's equivalent is still called "Sensei"; Tinker's is "Coach".

**Depends on [[02-playbook-skill-marketplace]] being built first.**

## Goal

A new user opens Tinker. Instead of a blank canvas, Coach surfaces 3–5 skills pre-filtered by role, connected tools, and recent activity. User installs one, gets a result, learns what's possible.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` Looks at which tools you've connected, your role, and what you've been working on
- `[2026-04-10]` Recommends the skills most likely to be useful right now
- `[2026-04-10]` A new account manager doesn't browse 350 skills — Ramp's Sensei surfaces the 5 that matter on day one
- `[2026-04-10]` "Rather than expecting people to know what's available, Glass meets them where they are"

## Tinker Scope

### v1 Scope — "Coach-lite"
- `[2026-04-14]` **Scoring function** over the Playbook skill index, sorted by relevance
- `[2026-04-14]` **Surfaces**:
  - FirstRun suggested skills strip
  - Today pane "Recommended for you" section
  - Skill browser default sort
- `[2026-04-14]` **Signals**:
  - Connected MCP tools (skill declares tool dependencies in frontmatter)
  - User-declared role (optional — asked during first-run, editable later)
  - Recent vault activity (which entity types / projects have been touched recently)
  - Skill popularity (install count if Git remote tracks it)

### v2 / later
- Embedding-based semantic matching between user activity and skill descriptions
- Collaborative filtering ("users like you installed these")
- Active recommendation ("you just did X manually — there's a skill for that")

## Scoring Function (v1)

For a user U and a skill S:

```
score(U, S) =
    1.0 * tool_match(U, S)           // skill's required tools are all connected
  + 0.5 * role_match(U, S)           // skill's role tag matches user role
  + 0.3 * recency_match(U, S)        // skill relates to entities user touched in last 7 days
  + 0.2 * popularity_score(S)        // install count normalized across team Playbook
  - 1.0 * already_installed(U, S)    // suppress already-installed skills in "discover" view
```

- `[2026-04-14]` Weights are starting heuristics — iterate based on user behavior (install rate after recommendation = primary signal)
- `[2026-04-14]` `tool_match` is a hard filter: if skill requires Linear and user hasn't connected Linear → score = 0
- `[2026-04-14]` `recency_match` queries SQLite entity activity for tags that match skill description keywords

## Data Model

### Skill frontmatter extensions

```yaml
---
name: kebab-case-skill
description: One-liner for Coach to score against
tools: [gmail, calendar]            # required MCP integrations
roles: [sales, cx, finance]         # optional role tags
categories: [reporting, drafting]   # topic tags
---
```

### User profile (in SQLite `user_profile` table)

```typescript
type UserProfile = {
  role?: string;                    // optional, user-declared
  connectedTools: string[];         // derived from sign-in + MCP state
  recentEntityTags: string[];       // rolling window of last 7 days vault activity
};
```

## Implementation Outline

### Package boundary
- `[2026-04-14]` **`packages/coach`** — new package: scoring function, recommendation query API
- `[2026-04-14]` **`packages/memory`** — extends with `user_profile` table + skill-index tables (shared with [[02-playbook-skill-marketplace]])

### API

```typescript
export type Recommendation = {
  skill: Skill;
  score: number;
  reasons: string[];   // human-readable why (for UI tooltips)
};

export async function recommendSkills(
  profile: UserProfile,
  limit: number = 5,
  excludeInstalled: boolean = true
): Promise<Recommendation[]>;
```

### UI integration
- `[2026-04-14]` FirstRun: shows top 3 after sign-in + role selection
- `[2026-04-14]` Today pane: "Skills for you" widget with 3–5 recs; refreshes daily
- `[2026-04-14]` Skill browser: default sort uses score; user can flip to alphabetical / recency / popularity

## Out of Scope

- `[2026-04-14]` Embedding-based semantic matching — v2
- `[2026-04-14]` Real-time "you just did X" suggestions — v2
- `[2026-04-14]` Cross-user collaborative filtering — requires hosted backend, out of scope

## Open Questions

- **Role declaration**: mandatory vs. optional at first-run? Leaning optional — don't gate value on a setup step.
- **Popularity signal**: if skills live in a user's private Git repo (no shared team Playbook), popularity is zero. Fall back to tool_match + recency dominant.
- **Reasons surfaced to user**: tooltip vs. inline row ("Recommended because: you use Gmail + Calendar"). Leaning tooltip.

## Open-Source References

- `ramp-glass` Sensei (closed source, conceptual reference only — Tinker's equivalent is Coach)
- Simple recommendation patterns: weighted linear scoring is intentionally minimal; don't over-engineer v1

## Acceptance Criteria

- [ ] Coach recommends 3–5 skills on FirstRun based on connected tools + declared role
- [ ] Today pane shows a "Skills for you" widget with fresh recommendations
- [ ] Skill browser default sort uses Coach score
- [ ] Hard filter on tool_match prevents recommending skills the user can't run
- [ ] Recommendations exclude already-installed skills
- [ ] `reasons` field populated for UI tooltips

## Connections
- [[02-playbook-skill-marketplace]] — hard dependency
- [[ramp-glass]] — Sensei (Ramp's equivalent, the naming heritage we dropped)
- [[03-memory-pipeline]] — recency signal source
