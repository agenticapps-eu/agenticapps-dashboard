import { describe, it, expect } from 'vitest'

import { AuthFileSchema } from './auth.js'

describe('AuthFileSchema', () => {
  it('accepts a valid auth file', () => {
    const valid = { version: 1, token: 'abc-def', rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1-alpha.4' }
    expect(() => AuthFileSchema.parse(valid)).not.toThrow()
  })
  it('rejects version other than 1', () => {
    expect(() => AuthFileSchema.parse({ version: 2, token: 'x', rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' })).toThrow()
  })
  it('rejects non-ISO rotatedAt', () => {
    expect(() => AuthFileSchema.parse({ version: 1, token: 'x', rotatedAt: 'yesterday', agentVersion: '0.0.1' })).toThrow()
  })
  it('rejects missing token', () => {
    expect(() => AuthFileSchema.parse({ version: 1, rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' })).toThrow()
  })
})
