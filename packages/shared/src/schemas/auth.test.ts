import { describe, it, expect } from 'vitest'

import { AuthFileSchema } from './auth.js'

const VALID_TOKEN = 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000-11111111'

describe('AuthFileSchema', () => {
  it('accepts a valid auth file with D-13 dashed-hex token', () => {
    const valid = { version: 1, token: VALID_TOKEN, rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1-alpha.4' }
    expect(() => AuthFileSchema.parse(valid)).not.toThrow()
  })
  it('rejects version other than 1', () => {
    expect(() => AuthFileSchema.parse({ version: 2, token: VALID_TOKEN, rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' })).toThrow()
  })
  it('rejects non-ISO rotatedAt', () => {
    expect(() => AuthFileSchema.parse({ version: 1, token: VALID_TOKEN, rotatedAt: 'yesterday', agentVersion: '0.0.1' })).toThrow()
  })
  it('rejects missing token', () => {
    expect(() => AuthFileSchema.parse({ version: 1, rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' })).toThrow()
  })
  it('rejects token with wrong group length (4-char groups)', () => {
    const bad = { version: 1, token: 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111', rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' }
    expect(() => AuthFileSchema.parse(bad)).toThrow()
  })
  it('rejects token with non-hex chars', () => {
    const bad = { version: 1, token: 'gggggggg-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000-11111111', rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' }
    expect(() => AuthFileSchema.parse(bad)).toThrow()
  })
  it('rejects token with wrong group count (7 groups)', () => {
    const bad = { version: 1, token: 'aaaaaaaa-bbbbbbbb-cccccccc-dddddddd-eeeeeeee-ffffffff-00000000', rotatedAt: '2026-05-03T10:00:00.000Z', agentVersion: '0.0.1' }
    expect(() => AuthFileSchema.parse(bad)).toThrow()
  })
})
