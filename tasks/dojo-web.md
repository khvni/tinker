# W6 · Dojo web + Sensei

You are building the public face of Dojo — a Next.js 15 App Router app on Vercel that hosts the skill index and the Sensei recommender endpoint. This app is completely decoupled from the Electron desktop app; they communicate only via HTTP.

## Context
- `ramp-glass-prd.md` §2.2 (Dojo), §2.3 (Sensei surfaces top-5 skills on day one).
- `AGENTS.md` global sections + the Next.js-specific note in §4.2 (RSC allowed here).
- Conductor env var: `CONDUCTOR_PORT` — use it for `next dev` port if set.

## Exclusive write scope
- `apps/dojo-web/**`

## What to build
1. Scaffold a fresh Next.js 15 App Router project in `apps/dojo-web/` (TypeScript, Tailwind, no `src/` directory, App Router). You may use `create-next-app` output as a starting point, then remove anything you don't need.
2. `app/page.tsx`: a simple public landing page listing the Dojo skill catalog with search and tag filters. Pure server component.
3. `app/api/skills/route.ts`: `GET /api/skills` returns the full index of skills parsed from the `dojo/skills/**` directory in the repo (use `fs` at build time or a prebuild script that copies the files into the app). Response shape:
   ```ts
   { skills: Array<{ name, description, author, team, tags, version, requires }> }
   ```
4. `app/api/sensei/route.ts`: `POST /api/sensei` takes `SenseiInput` and returns `SenseiRecommendation[]`. The recommender is a Claude call (`claude-sonnet-4-6`) with a tight system prompt, the skill index as structured input, and JSON-mode output. Top-5 only.
5. A deploy-to-Vercel config: `vercel.ts` per current Vercel conventions — typed config. Set the framework to `nextjs`, no cron needed for v1.
6. `apps/dojo-web/README.md`: local-dev steps and a one-liner for `vercel deploy --prebuilt`.

## Dependencies (read-only)
- `@ramp-glass/shared-types` for the `SenseiInput`, `SenseiRecommendation`, and `SkillFrontmatter` types (import them directly — this is a workspace package).
- You may add: `next`, `react`, `react-dom`, `tailwindcss`, `@anthropic-ai/sdk`, `zod`. Use current versions. Consult official Next.js and Vercel docs before pinning.

## Tests
- Unit (Vitest or Next's test setup): `/api/skills` returns the seed skills.
- Unit: `/api/sensei` with a mocked Claude client returns 5 recommendations sorted by score.
- Playwright smoke test: landing page renders the 3 seed skills.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/dojo-web build` produces a clean Next.js build.
- [ ] `pnpm --filter @ramp-glass/dojo-web dev` serves the landing page and both API routes locally.
- [ ] A Vercel preview deploy succeeds (you may skip this if the operator has no Vercel linkage yet — document it in the PR description).
- [ ] `POST /api/sensei` with a seed input returns 5 distinct skill names from the seed set.

## What you must NOT do
- Do not edit anything outside `apps/dojo-web/**`.
- Do not create a database for Dojo — the skill index is file-backed from `dojo/skills/**` at build time. Scale to 350+ skills is fine with file-backed loading.
- Do not use Edge functions where Node runtime works fine.
- Do not edit `packages/shared-types`.

## When done
`feat(dojo-web): Next.js app with skill index and Sensei recommender`. PR to `main`.
