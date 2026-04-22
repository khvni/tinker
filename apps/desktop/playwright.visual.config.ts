import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression config. Runs against Vite `dev:web` (browser-only, no
 * Tauri). See `agent-knowledge/reference/visual-testing.md` for why Paper PNG
 * exports are not the CI oracle.
 */
export default defineConfig({
  testDir: './playwright/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:1420',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm --filter @tinker/desktop dev:web',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      VITE_E2E: '1',
    },
  },
});
