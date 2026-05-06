import { describe, it, expect } from 'vitest'

import { DisciplineResponseSchema, RationalizationRowSchema } from './discipline.js'

describe('RationalizationRowSchema', () => {
  it('parses a valid rationalization row', () => {
    const input = { label: 'TDD is impractical for frontend', fires: 0 }
    expect(RationalizationRowSchema.parse(input)).toEqual(input)
  })

  it('rejects negative fires (must be nonnegative int)', () => {
    expect(() =>
      RationalizationRowSchema.parse({ label: 'x', fires: -1 })
    ).toThrow()
  })
})

describe('DisciplineResponseSchema', () => {
  it('parses a discipline response with a row and skillInstalled true', () => {
    const input = {
      rationalization: {
        rows: [{ label: 'TDD is impractical for frontend', fires: 0 }],
        skillInstalled: true,
      },
    }
    expect(DisciplineResponseSchema.parse(input)).toEqual(input)
  })

  it('parses empty state when skill not installed', () => {
    const input = {
      rationalization: { rows: [], skillInstalled: false },
    }
    expect(DisciplineResponseSchema.parse(input)).toEqual(input)
  })
})
