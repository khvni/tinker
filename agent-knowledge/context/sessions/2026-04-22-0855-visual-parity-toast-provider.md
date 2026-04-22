# 2026-04-22 08:55 — Visual parity boot fix

## Goal
Fix the `Visual parity` GitHub Action after all three Playwright specs timed out
waiting for `document.documentElement.dataset.appReady === 'true'`.

## What shipped
- `apps/desktop/src/renderer/main.tsx`
  - Wrapped the entire renderer tree in `@tinker/design`'s `ToastProvider`.

## Root cause
- The CI log showed the failure happened before any image comparison:
  `memory.spec.ts`, `settings.spec.ts`, and `workspace.spec.ts` all timed out in
  `waitForAppReady()`.
- Reproducing the browser-preview harness locally surfaced a runtime error:
  `useToast must be used inside <ToastProvider>`.
- `SaveAsSkillModal` uses `useToast`, and `Chat` mounts inside the default app
  shell during preview boot. The app tree had test-only `ToastProvider`
  coverage, but the real entrypoint did not.
- Once the root render crashed, `App` never completed its ready effect, so the
  Playwright specs all waited on a flag that never changed.

## Verified
- Browser preview (`VITE_E2E=1 pnpm --dir apps/desktop dev:web`) boots with
  `data-app-ready="true"`.
- Preview checks confirm:
  - workspace cold-boot reaches ready
  - Memory sidebar opens and renders the expected heading
  - Settings sidebar opens and shows `Account` + `Connections`
- `pnpm --dir apps/desktop exec tsc --noEmit -p tsconfig.json`
- `pnpm --dir apps/desktop exec vitest run src/renderer/panes/Chat/Chat.test.tsx src/renderer/panes/Chat/Chat.skill-reinject.test.tsx src/renderer/opencode.test.ts`
