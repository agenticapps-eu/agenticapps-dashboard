import { defineConfig } from 'vitest/config'

/**
 * Separate vitest config for scripts/ tests (screenshot.test.mjs etc.).
 * Runs in node environment — no jsdom, no Playwright launch.
 * Usage: pnpm --filter @agenticapps/dashboard-spa exec vitest run --config vitest.scripts.config.ts scripts/screenshot.test.mjs
 *
 * Phase 6 Plan 01: screenshot.mjs extended with --route/--viewport flags.
 */
export default defineConfig({
  test: {
    name: 'scripts',
    environment: 'node',
    include: ['scripts/**/*.test.mjs', 'scripts/**/*.test.ts'],
    testTimeout: 10_000,
  },
})
