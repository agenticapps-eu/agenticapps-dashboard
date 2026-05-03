import { describe, it, expect } from 'vitest'
import { RegistryEntrySchema, RegistryFileSchema, RegistryListItemSchema, StatusResponseSchema } from './registry.js'

describe('RegistryEntrySchema', () => {
  const valid = { id: 'acme', name: 'acme', root: '/Users/x/acme', client: null, addedAt: '2026-05-03T10:00:00.000Z', tags: [] }
  it('accepts valid entry with null client', () => {
    expect(() => RegistryEntrySchema.parse(valid)).not.toThrow()
  })
  it('accepts string client', () => {
    expect(() => RegistryEntrySchema.parse({ ...valid, client: 'ACME Inc' })).not.toThrow()
  })
  it('rejects missing id', () => {
    const { id: _id, ...rest } = valid
    expect(() => RegistryEntrySchema.parse(rest)).toThrow()
  })
})

describe('RegistryFileSchema', () => {
  it('accepts empty projects', () => {
    expect(() => RegistryFileSchema.parse({ version: 1, projects: [] })).not.toThrow()
  })
})

describe('RegistryListItemSchema', () => {
  it('extends entry with status block', () => {
    const item = { id: 'a', name: 'a', root: '/x', client: null, addedAt: '2026-05-03T10:00:00.000Z', tags: [], status: { reachable: true, currentPhase: '01', lastCommitAt: '2026-05-03T10:00:00.000Z' } }
    expect(() => RegistryListItemSchema.parse(item)).not.toThrow()
  })
  it('allows null currentPhase and lastCommitAt for unreachable', () => {
    const item = { id: 'a', name: 'a', root: '/x', client: null, addedAt: '2026-05-03T10:00:00.000Z', tags: [], status: { reachable: false, currentPhase: null, lastCommitAt: null } }
    expect(() => RegistryListItemSchema.parse(item)).not.toThrow()
  })
})

describe('StatusResponseSchema', () => {
  it('accepts a status payload', () => {
    const s = { reachable: true, uptime: 42, bindUrl: 'http://127.0.0.1:5193', registryCount: 0, pairedSince: null, tokenAge: 100 }
    expect(() => StatusResponseSchema.parse(s)).not.toThrow()
  })
})
