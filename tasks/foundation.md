# F0 · Foundation finishing (serial, before Wave 1)

The Wave 0 scaffolding is committed but a few pieces still need real work before Wave 1 agents can fan out. This is the single serial task that closes the gap.

## Exclusive write scope
- `.github/workflows/**` (the scaffold could not create these due to a local security hook; they need to be added here)
- `tsconfig.json` at repo root (a solution file referencing all packages)
- `pnpm-lock.yaml` (first-time generation)
- `packages/shared-types/src/**` (FINAL pass — this is the last chance to edit; after F0 merges, shared-types is FROZEN for Wave 1)

## What to build
1. `.github/workflows/ci.yml` — GitHub Actions pipeline running typecheck, lint, and test on every PR and push to `main`. Use `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` with `node-version-file: .nvmrc`. Never interpolate untrusted GitHub event data directly into `run:` — always route through `env:` with quoting.
2. Root `tsconfig.json` as a solution file with `references` pointing at every package and app.
3. First run of `pnpm install` → commit `pnpm-lock.yaml`.
4. First run of `pnpm typecheck` → fix any setup issues (module resolution, workspace references).
5. Review `packages/shared-types/src/**` one final time. If anything is missing that Wave 1 will obviously need, add it now. Once this PR merges, shared-types is frozen and changes require a coordinator PR.
6. Document the freeze: add a `FROZEN.md` marker file inside `packages/shared-types/` explaining the policy.

## Acceptance
- [ ] `pnpm install` and `pnpm typecheck` both succeed locally.
- [ ] CI runs green on the PR.
- [ ] `packages/shared-types/FROZEN.md` exists.
- [ ] A tag `v0.0.0-foundation` is pushed so Wave 1 agents can rebase cleanly from it.

## When done
`chore(foundation): CI, lockfile, shared-types freeze`. PR to `main`. Merge before dispatching any Wave-1 worktree in Conductor.
