/**
 * Playwright test runner config — Plan 07-01 Task 7.
 *
 * Wave 0 of Phase 7 — runner config + `e2e/` directory shape. Actual e2e
 * specs land in Plan 07-05 (reviewer-checklist walkthrough).
 *
 * Two projects:
 *   chromium-desktop — 1440x900 (the impeccable critique viewport)
 *   chromium-mobile  — 375x800  (the HelpLayout mobile drawer viewport)
 *
 * The webServer block auto-spawns `pnpm --filter @agenticapps/dashboard-spa dev`
 * with reuseExistingServer:true in dev (CI starts a fresh server).
 *
 * @see .planning/phases/07-help-docs-v1-0/07-RESEARCH.md §Validation Architecture
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 } },
    },
  ],
  webServer: {
    command: 'pnpm --filter @agenticapps/dashboard-spa dev',
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
