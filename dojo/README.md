# Dojo — Glass skills marketplace

This directory holds the company-wide skill library Glass loads at runtime. Skills are markdown files with YAML frontmatter; each one teaches the agent exactly how to perform one task.

- **One skill per file.** Filename is kebab-case of the `name` field.
- **Git-backed, versioned, reviewed like code.** Every skill PR needs one approver.
- **No sensitive data.** Skills are shared org-wide.
- **Organize by team or domain.** `dojo/skills/<team>/<skill>.md`.

## Seed skills (from the article's examples)

- `skills/sales/analyze-gong-competitive.md`
- `skills/cx/zendesk-investigation.md`
- `skills/finance/daily-spend-anomalies.md`

The article cites 350+ skills at scale. The `@ramp-glass/skills` package loader is built to handle that volume efficiently — see `packages/skills/` and `tasks/skills.md`.
