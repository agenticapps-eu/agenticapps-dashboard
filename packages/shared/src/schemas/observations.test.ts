import { describe, it, expect } from 'vitest'

import { HookFiringSchema, ObservationsRecentResponseSchema } from './observations.js'

const validHookFiring = {
  ts: '2026-05-06T10:00:00Z',
  skill: 'meta-observer',
  hook: 'PreToolUse',
}

describe('HookFiringSchema', () => {
  it('parses a hook firing and preserves unknown fields (passthrough)', () => {
    const input = {
      ts: '2026-05-06T10:00:00Z',
      skill: 'meta-observer',
      hook: 'PreToolUse',
      payload: { row: 'foo' },
      extraFutureField: true,
    }
    expect(HookFiringSchema.parse(input)).toEqual(input)
  })

  it('rejects a hook firing missing the required hook field', () => {
    expect(() =>
      HookFiringSchema.parse({ ts: '2026-05-06T10:00:00Z', skill: 'x' })
    ).toThrow()
  })
})

describe('ObservationsRecentResponseSchema', () => {
  it('parses empty observations with skillInstalled false (DISC-04 shape)', () => {
    const input = { entries: [], skillInstalled: false }
    expect(ObservationsRecentResponseSchema.parse(input)).toEqual(input)
  })

  it('parses observations with entries and skillInstalled true', () => {
    const input = { entries: [validHookFiring], skillInstalled: true }
    expect(ObservationsRecentResponseSchema.parse(input)).toEqual(input)
  })
})
