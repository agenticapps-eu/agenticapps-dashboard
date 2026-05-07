import { describe, it, expect } from 'vitest'

import {
  AgentLinterSeveritySchema,
  AgentLinterDiagnosticSchema,
  AgentLinterCategoryScoreSchema,
  AgentLinterReportSchema,
  AgentLinterResponseSchema,
} from './agentlinter.js'

const validDiagnostic = {
  severity: 'warning' as const,
  category: 'Position Risk',
  rule: 'position-risk',
  file: '.claude/skills/foo/SKILL.md',
  message: 'Skill has a position risk issue',
}

const validCategoryScore = {
  name: 'Position Risk',
  score: 85,
  weight: 1.0,
  issues: 2,
}

const validReport = {
  score: 87,
  categories: [validCategoryScore],
  diagnostics: [validDiagnostic],
  files: ['.claude/skills/foo/SKILL.md'],
  timestamp: '2026-05-07T10:00:00Z',
}

describe('AgentLinterSeveritySchema', () => {
  it('accepts info', () => {
    expect(AgentLinterSeveritySchema.parse('info')).toBe('info')
  })

  it('accepts warning', () => {
    expect(AgentLinterSeveritySchema.parse('warning')).toBe('warning')
  })

  it('accepts error', () => {
    expect(AgentLinterSeveritySchema.parse('error')).toBe('error')
  })

  it('rejects medium (not in the 3-value set)', () => {
    expect(() => AgentLinterSeveritySchema.parse('medium')).toThrow()
  })

  it('rejects low (not in the 3-value set)', () => {
    expect(() => AgentLinterSeveritySchema.parse('low')).toThrow()
  })

  it('rejects critical (not in the 3-value set)', () => {
    expect(() => AgentLinterSeveritySchema.parse('critical')).toThrow()
  })
})

describe('AgentLinterDiagnosticSchema', () => {
  it('parses a complete diagnostic', () => {
    const input = { ...validDiagnostic, line: 12, fix: 'Add a description field' }
    expect(AgentLinterDiagnosticSchema.parse(input)).toEqual(input)
  })

  it('parses a diagnostic without optional line and fix', () => {
    expect(AgentLinterDiagnosticSchema.parse(validDiagnostic)).toEqual(validDiagnostic)
  })

  it('rejects diagnostic without required message', () => {
    const { message: _unused, ...withoutMessage } = validDiagnostic
    void _unused
    expect(() => AgentLinterDiagnosticSchema.parse(withoutMessage)).toThrow()
  })
})

describe('AgentLinterCategoryScoreSchema', () => {
  it('parses a valid category score', () => {
    expect(AgentLinterCategoryScoreSchema.parse(validCategoryScore)).toEqual(validCategoryScore)
  })
})

describe('AgentLinterReportSchema', () => {
  it('parses a valid report', () => {
    expect(AgentLinterReportSchema.parse(validReport)).toEqual(validReport)
  })

  it('preserves unknown fields via passthrough (future AgentLinter version bumps)', () => {
    const input = { ...validReport, newFieldFromV2: 'some value' }
    expect(AgentLinterReportSchema.parse(input)).toEqual(input)
  })
})

describe('AgentLinterResponseSchema — discriminated union on kind', () => {
  it('parses kind: ok with report and cachedAt', () => {
    const input = { kind: 'ok' as const, report: validReport, cachedAt: '2026-05-07T10:00:00Z' }
    expect(AgentLinterResponseSchema.parse(input)).toEqual(input)
  })

  it('parses kind: not-installed', () => {
    const input = { kind: 'not-installed' as const }
    expect(AgentLinterResponseSchema.parse(input)).toEqual(input)
  })

  it('parses kind: timeout', () => {
    const input = { kind: 'timeout' as const }
    expect(AgentLinterResponseSchema.parse(input)).toEqual(input)
  })

  it('parses kind: error with exitCode and stderr', () => {
    const input = { kind: 'error' as const, exitCode: 1, stderr: 'AgentLinter crashed' }
    expect(AgentLinterResponseSchema.parse(input)).toEqual(input)
  })

  it('parses kind: unparseable with exitCode and rawStdout', () => {
    const input = { kind: 'unparseable' as const, exitCode: 2, rawStdout: 'not json' }
    expect(AgentLinterResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects unknown kind', () => {
    expect(() => AgentLinterResponseSchema.parse({ kind: 'unknown' })).toThrow()
  })

  it('round-trip stability for ok variant', () => {
    const input = { kind: 'ok' as const, report: validReport, cachedAt: '2026-05-07T10:00:00Z' }
    const serialized = JSON.stringify(AgentLinterResponseSchema.parse(input))
    const reparsed = AgentLinterResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })

  it('round-trip stability for error variant', () => {
    const input = { kind: 'error' as const, exitCode: 1, stderr: 'err' }
    const serialized = JSON.stringify(AgentLinterResponseSchema.parse(input))
    const reparsed = AgentLinterResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})
