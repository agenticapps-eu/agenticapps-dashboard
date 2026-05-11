// @vitest-environment node
/**
 * Plan 07-05 Task 4 — guards the deletion of the legacy /help route + test.
 *
 * If anyone re-adds packages/spa/src/routes/help.lazy.tsx in a future change,
 * this test fails immediately. HELP-06 requires the legacy file is gone.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROUTES_DIR = resolve(HERE, '..', '..', 'routes')

describe('Legacy /help route is deleted (HELP-06)', () => {
  it('packages/spa/src/routes/help.lazy.tsx does NOT exist', () => {
    expect(existsSync(resolve(ROUTES_DIR, 'help.lazy.tsx'))).toBe(false)
  })

  it('packages/spa/src/routes/__tests__/help.test.tsx does NOT exist', () => {
    expect(existsSync(resolve(ROUTES_DIR, '__tests__', 'help.test.tsx'))).toBe(false)
  })
})
