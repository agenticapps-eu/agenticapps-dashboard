import { describe, it, expect } from 'vitest'

import { ProjectOverviewSchema } from './overview.js'

const minimalValid = {
  phaseStatus: 'Pending' as const,
  stage1: null,
  stage2: null,
  dbAudit: null,
  tdd: null,
  verification: null,
  branch: null,
  markers: { gitRepo: false, planning: false, claudeSkills: false },
}

describe('ProjectOverviewSchema', () => {
  it('accepts minimal valid overview with all nulls', () => {
    expect(() => ProjectOverviewSchema.parse(minimalValid)).not.toThrow()
  })

  it('accepts rich valid overview with populated sub-objects', () => {
    const richValid = {
      phaseStatus: 'In Progress',
      stage1: { ran: true, findings: { red: 0, yellow: 2, green: 5 } },
      stage2: null,
      dbAudit: { findings: { critical: 0, high: 1, medium: 0, low: 0 } },
      tdd: { greenPairs: 4, totalTasks: 5 },
      verification: { evidence: 3, mustHaves: 4 },
      branch: 'main',
      markers: { gitRepo: true, planning: true, claudeSkills: false },
    }
    expect(() => ProjectOverviewSchema.parse(richValid)).not.toThrow()
  })

  it('rejects invalid phaseStatus "Done"', () => {
    expect(() =>
      ProjectOverviewSchema.parse({ ...minimalValid, phaseStatus: 'Done' })
    ).toThrow()
  })

  it('rejects negative finding counts', () => {
    expect(() =>
      ProjectOverviewSchema.parse({
        ...minimalValid,
        stage1: { ran: true, findings: { red: -1, yellow: 0, green: 0 } },
      })
    ).toThrow()
  })
})
