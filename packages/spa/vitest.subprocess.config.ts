import { defineConfig } from 'vitest/config'

/**
 * Separate vitest config for subprocess tests (dev-perf-smoke + register-optimistic).
 * Runs in node environment with forks pool so jsdom and spawn don't clash (T-02-28).
 * Usage: pnpm --filter @agenticapps/dashboard-spa test:subprocess
 *
 * Phase 3 Plan 11: register-optimistic.test.ts added — daemon round-trip subprocess test.
 */
export default defineConfig({
  test: {
    name: 'subprocess',
    environment: 'node',
    include: [
      'src/__tests__/dev-perf-smoke.test.ts',
      'src/__tests__/register-optimistic.test.ts',
    ],
    testTimeout: 60_000,
    pool: 'forks',
    // Vitest 4: poolOptions removed — singleFork is now top-level under forks
    forks: { singleFork: true },
  },
})
