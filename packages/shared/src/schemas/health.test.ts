import { describe, it, expect } from 'vitest'

import { HealthResponseSchema } from '../index.js'

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const valid = { ok: true, version: '0.0.1-alpha.2' }
    expect(() => HealthResponseSchema.parse(valid)).not.toThrow()
  })

  it('rejects missing ok field', () => {
    expect(() => HealthResponseSchema.parse({ version: '0.0.1' })).toThrow()
  })

  it('accepts optional message', () => {
    const valid = { ok: true, version: '1.0.0', message: 'hi' }
    const parsed = HealthResponseSchema.parse(valid)
    expect(parsed.message).toBe('hi')
  })
})
