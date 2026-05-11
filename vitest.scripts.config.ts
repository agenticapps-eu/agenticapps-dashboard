import { defineConfig } from 'vitest/config'

/**
 * Vitest config for repo-root scripts/ tests.
 * Runs in node environment — no jsdom.
 * Usage: pnpm exec vitest run --config vitest.scripts.config.ts scripts/check-impeccable-score.test.mjs
 *
 * Phase 6 Plan 06: check-impeccable-score.mjs parser tests.
 */
export default defineConfig({
  test: {
    name: 'scripts',
    environment: 'node',
    include: ['scripts/**/*.test.mjs', 'scripts/**/*.test.ts'],
    testTimeout: 10_000,
  },
})
