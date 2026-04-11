# W10 · End-to-end tests + source-fidelity checklist (Wave 2, final)

You are writing the tests that prove Glass matches the article. Every box in PRD §9 ("Source Fidelity Checklist") gets a corresponding Playwright-Electron test.

**Start only after Wave 2's W7, W8, W9 have merged.** You need everything running end to end.

## Context
- `ramp-glass-prd.md` §6 (non-negotiable quality bars), §9 (source fidelity checklist).
- `AGENTS.md` §4.5 tests.

## Exclusive write scope
- `tests/e2e/**` (new directory at repo root)
- `playwright.config.ts` at repo root

## What to build
1. Playwright-Electron harness that launches the built desktop app with a mocked Anthropic client, mocked Okta, and mocked MCP integrations. Uses fixture data for memory and skills.
2. One test per checklist item in PRD §9. Each test:
   - Names itself after the checklist item.
   - Asserts the specific UX or data outcome the article claims.
   - Fails loudly if the claim is no longer true.
3. A "first-run" smoke test that walks the full first-launch flow: Okta sign-in → memory bootstrap → Sensei top-5 pinned → user clicks into a skill → first successful skill run.
4. A "layout persistence" test that relaunches the app and asserts identical layout state.
5. A "self-heal" test that forces a 401 on one integration and asserts no error surfaces in the UI.
6. A "schedule-to-run" test: describe a cron job in prompt form → assert it runs → assert the output arrives at the mocked Slack channel.
7. A report generator that prints the checklist with ✓/✗ next to each item so the team can see fidelity at a glance.

## Dependencies
- All Wave 1 + Wave 2 packages merged.
- `@playwright/test`, `playwright-electron` or `@playwright/test`'s experimental Electron support. Consult the current Playwright docs before pinning.

## Acceptance
- [ ] Every box in PRD §9 has a passing test.
- [ ] The fidelity report prints ✓ for every item.
- [ ] CI runs the full E2E suite on every PR to `main`.

## What you must NOT do
- Do not test against real external services in CI.
- Do not hit the real Anthropic API in CI — use a recorded-fixtures client.
- Do not mark a test "skipped" to make the suite green. If it can't pass, the underlying phase isn't done.

## When done
`test(e2e): source fidelity suite for PRD §9`. PR to `main`. This PR closes the v1 loop.
