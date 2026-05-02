import { describe, it, expect } from 'vitest'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

describe('agent → shared workspace resolution', () => {
  it('imports HealthResponseSchema from shared package', () => {
    const result = HealthResponseSchema.parse({ ok: true, version: '0.0.1-alpha.3' })
    expect(result.ok).toBe(true)
  })
})
