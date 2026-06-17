import { describe, it, expect } from 'vitest'

import { ClaudeMdEvalSchema, RungCheckSchema, ClaudeMdLevelSchema } from './claudeMdLevel.js'

const validRung = {
  rung: 1,
  label: 'Basic',
  passed: true,
  evidence: ['CLAUDE.md found and git-tracked'],
}

const validL4Eval = {
  level: 4,
  levelLabel: 'Abstracted',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['CLAUDE.md git-tracked'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import ref found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['rules/path.md has paths:'] },
    { rung: 5, label: 'Maintained', passed: false, evidence: ['mtime 180d ago'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['No .claude/skills/'] },
  ],
  nextSteps: ['Keep CLAUDE.md updated (edit within 90 days) or add a backbone doc → L5.'],
  inferred: false,
}

describe('ClaudeMdLevelSchema', () => {
  it('accepts 0..6', () => {
    for (let i = 0; i <= 6; i++) expect(ClaudeMdLevelSchema.parse(i)).toBe(i)
  })

  it('rejects 7 (above max)', () => {
    expect(() => ClaudeMdLevelSchema.parse(7)).toThrow()
  })

  it('rejects -1 (below min)', () => {
    expect(() => ClaudeMdLevelSchema.parse(-1)).toThrow()
  })

  it('rejects non-integer 2.5', () => {
    expect(() => ClaudeMdLevelSchema.parse(2.5)).toThrow()
  })
})

describe('RungCheckSchema', () => {
  it('parses a complete rung with all fields', () => {
    const input = { ...validRung, line: undefined, fix: undefined }
    expect(RungCheckSchema.parse(validRung)).toEqual(validRung)
  })

  it('parses rung without optional inferred field', () => {
    expect(RungCheckSchema.parse(validRung)).toEqual(validRung)
  })

  it('accepts L5 rung with inferred:true', () => {
    const l5rung = { ...validRung, rung: 5, passed: true, inferred: true }
    expect(() => RungCheckSchema.parse(l5rung)).not.toThrow()
  })

  it('rejects rung without required evidence field', () => {
    const { evidence: _omit, ...withoutEvidence } = validRung
    void _omit
    expect(() => RungCheckSchema.parse(withoutEvidence)).toThrow()
  })

  it('rejects rung without required label field', () => {
    const { label: _omit, ...withoutLabel } = validRung
    void _omit
    expect(() => RungCheckSchema.parse(withoutLabel)).toThrow()
  })
})

describe('ClaudeMdEvalSchema', () => {
  it('round-trips a valid L4 eval without throwing', () => {
    expect(() => ClaudeMdEvalSchema.parse(validL4Eval)).not.toThrow()
  })

  it('rejects eval without required rungs field', () => {
    const { rungs: _omit, ...withoutRungs } = validL4Eval
    void _omit
    expect(() => ClaudeMdEvalSchema.parse(withoutRungs)).toThrow()
  })

  it('rejects eval without required level field', () => {
    const { level: _omit, ...withoutLevel } = validL4Eval
    void _omit
    expect(() => ClaudeMdEvalSchema.parse(withoutLevel)).toThrow()
  })

  it('rejects eval with level out of range (level: 7)', () => {
    expect(() => ClaudeMdEvalSchema.parse({ ...validL4Eval, level: 7 })).toThrow()
  })

  it('rejects eval with level out of range (level: -1)', () => {
    expect(() => ClaudeMdEvalSchema.parse({ ...validL4Eval, level: -1 })).toThrow()
  })

  it('round-trip stability: parse(JSON.parse(JSON.stringify(parsed))) deepEquals parsed', () => {
    const parsed = ClaudeMdEvalSchema.parse(validL4Eval)
    const reparsed = ClaudeMdEvalSchema.parse(JSON.parse(JSON.stringify(parsed)))
    expect(reparsed).toEqual(parsed)
  })

  it('accepts an L0 eval (all rungs failed, level: 0)', () => {
    const l0eval = {
      level: 0,
      levelLabel: 'Absent',
      rungs: [
        { rung: 1, label: 'Basic', passed: false, evidence: ['No CLAUDE.md found'] },
        { rung: 2, label: 'Scoped', passed: false, evidence: ['No CLAUDE.md to check'] },
        { rung: 3, label: 'Structured', passed: false, evidence: ['No CLAUDE.md to check'] },
        { rung: 4, label: 'Abstracted', passed: false, evidence: ['No CLAUDE.md to check'] },
        { rung: 5, label: 'Maintained', passed: false, inferred: true, evidence: ['No CLAUDE.md found'] },
        { rung: 6, label: 'Adaptive', passed: false, evidence: ['No .claude/skills/'] },
      ],
      nextSteps: ['Add a CLAUDE.md at the repo root and commit it → L1.'],
      inferred: false,
    }
    expect(() => ClaudeMdEvalSchema.parse(l0eval)).not.toThrow()
  })

  it('accepts eval with inferred:true at headline (L5 awarded via proxy)', () => {
    const l5inferredEval = {
      level: 5,
      levelLabel: 'Maintained',
      rungs: [
        { rung: 1, label: 'Basic', passed: true, evidence: ['CLAUDE.md git-tracked'] },
        { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
        { rung: 3, label: 'Structured', passed: true, evidence: ['@import ref found'] },
        { rung: 4, label: 'Abstracted', passed: true, evidence: ['rules/path.md has paths:'] },
        { rung: 5, label: 'Maintained', passed: true, inferred: true, evidence: ['mtime 30d ago'] },
        { rung: 6, label: 'Adaptive', passed: false, evidence: ['No mcp.json'] },
      ],
      nextSteps: ['Add .claude/skills/ and mcp.json → L6.'],
      inferred: true,
    }
    expect(() => ClaudeMdEvalSchema.parse(l5inferredEval)).not.toThrow()
  })
})
