import { describe, it, expect } from 'vitest'

import { SecretsResponseSchema } from './secrets.js'

describe('SecretsResponseSchema — discriminated union on state', () => {
  it('parses state: present-valid with workspaceId', () => {
    const input = { state: 'present-valid' as const, workspaceId: 'ws-abc123' }
    expect(SecretsResponseSchema.parse(input)).toEqual(input)
  })

  it('parses state: present-valid with workspaceId and defaultEnvironment', () => {
    const input = {
      state: 'present-valid' as const,
      workspaceId: 'ws-abc123',
      defaultEnvironment: 'production',
    }
    expect(SecretsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects state: present-valid without workspaceId', () => {
    expect(() =>
      SecretsResponseSchema.parse({ state: 'present-valid', defaultEnvironment: 'prod' })
    ).toThrow()
  })

  it('parses state: present-invalid with reason', () => {
    const input = { state: 'present-invalid' as const, reason: 'JSON is malformed' }
    expect(SecretsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects state: present-invalid without reason', () => {
    expect(() => SecretsResponseSchema.parse({ state: 'present-invalid' })).toThrow()
  })

  it('parses state: absent', () => {
    const input = { state: 'absent' as const }
    expect(SecretsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects unknown state', () => {
    expect(() => SecretsResponseSchema.parse({ state: 'unknown' })).toThrow()
  })

  it('round-trip stability for present-valid', () => {
    const input = { state: 'present-valid' as const, workspaceId: 'ws-123', defaultEnvironment: 'dev' }
    const serialized = JSON.stringify(SecretsResponseSchema.parse(input))
    const reparsed = SecretsResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })

  it('round-trip stability for absent', () => {
    const input = { state: 'absent' as const }
    const serialized = JSON.stringify(SecretsResponseSchema.parse(input))
    const reparsed = SecretsResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})
