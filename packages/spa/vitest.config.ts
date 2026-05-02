import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'spa',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
