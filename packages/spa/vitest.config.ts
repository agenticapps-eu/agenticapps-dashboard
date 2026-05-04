import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    name: 'spa',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    // Unit + e2e tests (jsdom). Subprocess test lives in vitest.subprocess.config.ts
    // to avoid jsdom/spawn pool clash (T-02-28).
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/__tests__/dev-perf-smoke.test.ts'],
  },
})
