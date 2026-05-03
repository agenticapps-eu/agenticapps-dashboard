import { describe, it, expect } from 'vitest'

import { HealthResponseSchema } from '../index.js'

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const valid = { ok: true, version: '0.0.1-alpha.3' }
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

  it('accepts new optional fields (daemonVersion, registryCount, paired)', () => {
    const v = { ok: true, version: '1.0.0', daemonVersion: '0.1.0', registryCount: 3, paired: true }
    const parsed = HealthResponseSchema.parse(v)
    expect(parsed.daemonVersion).toBe('0.1.0')
    expect(parsed.registryCount).toBe(3)
    expect(parsed.paired).toBe(true)
  })

  it('still accepts old shape (only ok + version)', () => {
    expect(() => HealthResponseSchema.parse({ ok: true, version: '0.0.1' })).not.toThrow()
  })
})
