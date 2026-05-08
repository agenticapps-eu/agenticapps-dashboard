import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'meta-observer',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
