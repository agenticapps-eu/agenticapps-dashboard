import { describe, expect, it } from 'vitest'

import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'

describe('coverage column widths', () => {
  it('defines one shared width for each current desktop column', () => {
    expect(Object.keys(COVERAGE_COL_WIDTHS)).toEqual([
      'repo',
      'claudeMd',
      'workflow',
      'understand',
    ])
  })

  it('does not define retired integration or action columns', () => {
    expect(COVERAGE_COL_WIDTHS).not.toHaveProperty('gitNexus')
    expect(COVERAGE_COL_WIDTHS).not.toHaveProperty('wiki')
    expect(COVERAGE_COL_WIDTHS).not.toHaveProperty('actions')
  })
})
