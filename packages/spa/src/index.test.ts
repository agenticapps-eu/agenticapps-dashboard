import { describe, it, expect } from 'vitest'

import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

describe('spa → shared workspace resolution (jsdom)', () => {
  it('imports HealthResponseSchema from shared package', () => {
    const result = HealthResponseSchema.parse({ ok: true, version: '0.0.1-alpha.0' })
    expect(result.ok).toBe(true)
  })
})
