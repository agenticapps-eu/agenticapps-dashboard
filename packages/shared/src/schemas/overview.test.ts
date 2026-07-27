import { describe, it, expect } from 'vitest'

import { ProjectOverviewSchema } from './overview.js'

const minimalValid = {
  tdd: null,
  branch: null,
  markers: { gitRepo: false, planning: false, claudeSkills: false },
}

describe('ProjectOverviewSchema', () => {
  it('accepts minimal valid overview with all nulls', () => {
    expect(() => ProjectOverviewSchema.parse(minimalValid)).not.toThrow()
  })

  it('accepts a populated overview', () => {
    const richValid = {
      tdd: { greenPairs: 4, totalTasks: 5 },
      branch: 'main',
      markers: { gitRepo: true, planning: true, claudeSkills: false },
    }
    expect(() => ProjectOverviewSchema.parse(richValid)).not.toThrow()
  })

  it('rejects negative TDD counts', () => {
    expect(() =>
      ProjectOverviewSchema.parse({
        ...minimalValid,
        tdd: { greenPairs: -1, totalTasks: 0 },
      }),
    ).toThrow()
  })

  /*
   * The GSD phase reader is retired. Every field below was sourced from
   * `.planning/phases/<N>/` artifacts, which the daemon no longer reads. The
   * schema is strict so a stale producer is a parse failure rather than a
   * silently-dropped key — the same defence the registry schema took.
   */
  it.each(['phaseStatus', 'stage1', 'stage2', 'dbAudit', 'verification'])(
    'rejects the retired phase field %s',
    (field) => {
      expect(() =>
        ProjectOverviewSchema.parse({ ...minimalValid, [field]: null }),
      ).toThrow()
    },
  )

  it('no longer exports the phase finding-count schemas', async () => {
    const mod = await import('./overview.js')
    expect(Object.keys(mod)).not.toContain('FindingCountsSchema')
    expect(Object.keys(mod)).not.toContain('DbAuditFindingsSchema')
  })
})
