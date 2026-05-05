import { describe, it, expect } from 'vitest'

import {
  RegistryEntrySchema,
  RegistryFileSchema,
  RegistryListItemSchema,
  StatusResponseSchema,
  RegisterPrepareRequestSchema,
  RegisterPrepareResponseSchema,
  RegisterConfirmRequestSchema,
  RenameRequestSchema,
  TagsRequestSchema,
} from './registry.js'

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
    void _id
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

// ── Phase 3 schemas ───────────────────────────────────────────────────────────

describe('RegisterPrepareRequestSchema', () => {
  it('accepts a valid path', () => {
    expect(() => RegisterPrepareRequestSchema.parse({ path: '/foo' })).not.toThrow()
  })

  it('rejects missing path', () => {
    expect(() => RegisterPrepareRequestSchema.parse({})).toThrow()
  })
})

describe('RegisterPrepareResponseSchema', () => {
  const validEntry = {
    id: 'acme',
    name: 'acme',
    root: '/Users/x/acme',
    client: null,
    addedAt: '2026-05-03T10:00:00.000Z',
    tags: [],
  }

  it('parses allowed shape (blocked: false, alreadyRegistered: false)', () => {
    const allowed = {
      canonicalRoot: '/Users/x/acme',
      suggestedName: 'acme',
      suggestedSlug: 'acme',
      alreadyRegistered: false as const,
      blocked: false as const,
      detectedMarkers: { gitRepo: true, planning: true, claudeSkills: false },
      nonce: 'a'.repeat(16) + 'b'.repeat(16), // 32 hex chars
      expiresAt: Date.now() + 300_000,
    }
    expect(() => RegisterPrepareResponseSchema.parse(allowed)).not.toThrow()
  })

  it('parses blocked shape (blocked: true)', () => {
    const blocked = {
      canonicalRoot: '/Users/x/acme',
      blocked: true as const,
      blockedReason: '~/.ssh holds credentials/secrets',
    }
    expect(() => RegisterPrepareResponseSchema.parse(blocked)).not.toThrow()
  })

  it('parses alreadyRegistered shape (alreadyRegistered: true)', () => {
    const alreadyRegistered = {
      canonicalRoot: '/Users/x/acme',
      alreadyRegistered: true as const,
      existingEntry: validEntry,
    }
    expect(() => RegisterPrepareResponseSchema.parse(alreadyRegistered)).not.toThrow()
  })
})

describe('RegisterConfirmRequestSchema', () => {
  it('accepts valid nonce + required fields', () => {
    expect(() =>
      RegisterConfirmRequestSchema.parse({
        nonce: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
        name: 'foo',
        client: null,
        tags: [],
      })
    ).not.toThrow()
  })

  it('rejects nonce shorter than 32 chars', () => {
    expect(() =>
      RegisterConfirmRequestSchema.parse({ nonce: 'short' })
    ).toThrow()
  })
})

describe('RenameRequestSchema', () => {
  it('accepts a non-empty name', () => {
    expect(() => RenameRequestSchema.parse({ name: 'New' })).not.toThrow()
  })

  it('rejects empty string name', () => {
    expect(() => RenameRequestSchema.parse({ name: '' })).toThrow()
  })
})

describe('TagsRequestSchema', () => {
  it('accepts an array of tags', () => {
    expect(() => TagsRequestSchema.parse({ tags: ['a', 'b'] })).not.toThrow()
  })

  it('rejects non-array tags', () => {
    expect(() => TagsRequestSchema.parse({ tags: 'not-an-array' })).toThrow()
  })
})
