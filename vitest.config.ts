import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'tests'],
    coverage: {
      provider: 'v8',
      // json-summary writes coverage/coverage-summary.json, which is the
      // artifact the readiness `coverage` check reads. Without it this repo
      // reports `never` on its own dashboard.
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['packages/*/src/**'],
      exclude: ['packages/*/src/**/*.test.{ts,tsx}'],
    },
  },
})
