import { describe, it, expect } from 'vitest'

import { CommitmentBlockResponseSchema } from './commitment.js'

describe('CommitmentBlockResponseSchema', () => {
  it('parses a valid commitment block with markdown and sourceFile', () => {
    const input = {
      markdown: '## Workflow commitment\n- foo',
      sourceFile: '2026-05-06-session.md',
    }
    expect(CommitmentBlockResponseSchema.parse(input)).toEqual(input)
  })

  it('parses null commitment block (empty state shape)', () => {
    const input = { markdown: null, sourceFile: null }
    expect(CommitmentBlockResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects non-string markdown field', () => {
    expect(() =>
      CommitmentBlockResponseSchema.parse({ markdown: 42, sourceFile: 'x' })
    ).toThrow()
  })
})
