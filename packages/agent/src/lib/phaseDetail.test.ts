import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { makePhase4Fixture } from './__fixtures__/phase4-fixture.js'
import {
  parseCommitmentBlock,
  readSkillObservations,
  parseRationalizationRows,
} from './phaseDetail.js'

// ── parseCommitmentBlock tests ────────────────────────────────────────────────

describe('parseCommitmentBlock', () => {
  it('P1: returns markdown from highest-mtime .md when two files exist', () => {
    const fix = makePhase4Fixture()

    const pathA = fix.writeObservation('session-a.md', [
      '## Workflow commitment',
      'Old commitment block',
    ].join('\n'))
    const pathB = fix.writeObservation('session-b.md', [
      '## Workflow commitment',
      'New commitment block',
    ].join('\n'))
    // A is older, B is newer
    fix.setMtime(pathA, '2026-05-01T10:00:00Z')
    fix.setMtime(pathB, '2026-05-06T10:00:00Z')

    const result = parseCommitmentBlock(fix.root)
    expect(result.sourceFile).toBe('session-b.md')
    expect(result.markdown).toContain('New commitment block')

    fix.cleanup()
  })

  it('P2: returned markdown stops BEFORE the next H2 heading', () => {
    const fix = makePhase4Fixture()
    fix.writeObservation('session.md', [
      '## Workflow commitment',
      'The commitment text.',
      '',
      '## Some other heading',
      'other content',
    ].join('\n'))
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toContain('The commitment text.')
    expect(result.markdown).not.toContain('## Some other heading')
    expect(result.markdown).not.toContain('other content')
    fix.cleanup()
  })

  it('P3: when commitment block is the last section, extends to EOF', () => {
    const fix = makePhase4Fixture()
    fix.writeObservation('session.md', [
      '## Preamble',
      'some text',
      '',
      '## Workflow commitment',
      'My commitment at EOF.',
    ].join('\n'))
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toContain('My commitment at EOF.')
    fix.cleanup()
  })

  it('P4: when multiple commitment blocks exist in the same file, returns the LAST one', () => {
    const fix = makePhase4Fixture()
    fix.writeObservation('session.md', [
      '## Workflow commitment',
      'First commitment block',
      '',
      '## Interlude',
      'other text',
      '',
      '## Workflow commitment',
      'Second commitment block (the real one)',
    ].join('\n'))
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toContain('Second commitment block (the real one)')
    expect(result.markdown).not.toContain('First commitment block')
    fix.cleanup()
  })

  it('P5: missing .planning/skill-observations/ dir returns null markdown without throwing', () => {
    const fix = makePhase4Fixture()
    // Remove the skill-observations dir
    rmSync(join(fix.root, '.planning', 'skill-observations'), { recursive: true, force: true })
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toBeNull()
    expect(result.sourceFile).toBeNull()
    fix.cleanup()
  })

  it('P6: directory exists but has no .md files returns null', () => {
    const fix = makePhase4Fixture()
    // dir exists but empty (skill-observations was scaffolded empty in fixture)
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toBeNull()
    expect(result.sourceFile).toBeNull()
    fix.cleanup()
  })

  it('P7: file exists but has no ## Workflow commitment heading returns null', () => {
    const fix = makePhase4Fixture()
    fix.writeObservation('session.md', '## Other heading\nsome content\n')
    const result = parseCommitmentBlock(fix.root)
    expect(result.markdown).toBeNull()
    expect(result.sourceFile).toBeNull()
    fix.cleanup()
  })
})

// ── readSkillObservations tests ───────────────────────────────────────────────

describe('readSkillObservations', () => {
  it('O1: with meta-observer skill + 2 jsonl files returns top entries and skillInstalled:true', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkill()
    fix.writeJsonl('session-a.jsonl', [
      { ts: '2026-05-01T10:00:00Z', skill: 'gsd', hook: 'pre-phase' },
      { ts: '2026-05-01T11:00:00Z', skill: 'gsd', hook: 'post-phase' },
    ])
    fix.writeJsonl('session-b.jsonl', [
      { ts: '2026-05-06T09:00:00Z', skill: 'superpowers', hook: 'brainstorm' },
    ])

    const result = await readSkillObservations(fix.root, 20)
    expect(result.skillInstalled).toBe(true)
    expect(result.entries).toHaveLength(3)
    // Sorted by ts desc
    expect(result.entries[0]!.ts).toBe('2026-05-06T09:00:00Z')
    fix.cleanup()
  })

  it('O2: skill present but zero .jsonl files returns entries:[], skillInstalled:true', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkill()
    const result = await readSkillObservations(fix.root, 20)
    expect(result.skillInstalled).toBe(true)
    expect(result.entries).toHaveLength(0)
    fix.cleanup()
  })

  it('O3: without meta-observer skill returns entries:[], skillInstalled:false', async () => {
    const fix = makePhase4Fixture()
    // No writeMetaObserverSkill call. JSONL exists but the producing skill is
    // uninstalled — D-4-15 requires entries to be empty in that case.
    fix.writeJsonl('session.jsonl', [
      { ts: '2026-05-01T10:00:00Z', skill: 'gsd', hook: 'pre-phase' },
    ])
    const result = await readSkillObservations(fix.root, 20)
    expect(result.skillInstalled).toBe(false)
    expect(result.entries).toHaveLength(0)
    fix.cleanup()
  })

  it('O4: malformed JSONL line is silently skipped; valid lines parse', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkill()
    const dir = join(fix.root, '.planning', 'skill-observations')
    writeFileSync(join(dir, 'mixed.jsonl'), [
      '{"ts":"2026-05-01T10:00:00Z","skill":"gsd","hook":"pre"}',
      'NOT JSON AT ALL',
      '{"ts":"2026-05-01T11:00:00Z","skill":"gsd","hook":"post"}',
    ].join('\n') + '\n')
    const result = await readSkillObservations(fix.root, 20)
    expect(result.entries).toHaveLength(2)
    fix.cleanup()
  })

  it('O5: limit=20 returns 20 most recent when 30 available, sorted ts desc', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkill()
    const lines = Array.from({ length: 30 }, (_, i) => ({
      ts: `2026-05-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      skill: 'gsd',
      hook: 'hook',
    }))
    fix.writeJsonl('session.jsonl', lines)
    const result = await readSkillObservations(fix.root, 20)
    expect(result.entries).toHaveLength(20)
    // First entry should be the latest (May 30)
    expect(result.entries[0]!.ts).toBe('2026-05-30T00:00:00Z')
    fix.cleanup()
  })

  it('O6: lines missing ts, skill, or hook are skipped', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkill()
    const dir = join(fix.root, '.planning', 'skill-observations')
    writeFileSync(join(dir, 'partial.jsonl'), [
      '{"ts":"2026-05-01T10:00:00Z","skill":"gsd","hook":"pre"}',
      '{"skill":"gsd","hook":"pre"}',
      '{"ts":"2026-05-01T10:00:00Z","hook":"pre"}',
      '{"ts":"2026-05-01T10:00:00Z","skill":"gsd"}',
    ].join('\n') + '\n')
    const result = await readSkillObservations(fix.root, 20)
    expect(result.entries).toHaveLength(1)
    fix.cleanup()
  })

  it('O7: meta-observer at bundle layout (skill/SKILL.md) is detected', async () => {
    const fix = makePhase4Fixture()
    fix.writeMetaObserverSkillBundle()
    const result = await readSkillObservations(fix.root, 20)
    expect(result.skillInstalled).toBe(true)
    fix.cleanup()
  })
})

// ── parseRationalizationRows tests ───────────────────────────────────────────

const SKILL_WITH_TABLE = [
  '# Workflow Skill',
  '',
  '## Rationalization Table — Check Before Skipping Anything',
  '',
  '| If you think | Then remember |',
  '| --- | --- |',
  '| "Row label one" | reminder one |',
  '| "Row label two" | reminder two |',
  '| "Row label three" | reminder three |',
  '',
  '## Next section',
].join('\n')

describe('parseRationalizationRows', () => {
  it('R1: SKILL.md with 3-row table returns 3 rows with stripped labels', () => {
    const fix = makePhase4Fixture()
    fix.writeWorkflowSkill(SKILL_WITH_TABLE)
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(true)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]!.label).toBe('Row label one')
    expect(result.rows[1]!.label).toBe('Row label two')
    expect(result.rows[2]!.label).toBe('Row label three')
    fix.cleanup()
  })

  it('R2: entry whose payload matches a label increments that row fires count', () => {
    const fix = makePhase4Fixture()
    fix.writeWorkflowSkill(SKILL_WITH_TABLE)
    const entries = [
      { ts: '2026-05-01T10:00:00Z', skill: 'gsd', hook: 'pre', payload: 'Row label two' },
      { ts: '2026-05-01T11:00:00Z', skill: 'gsd', hook: 'pre', payload: 'Row label two' },
    ]
    const result = parseRationalizationRows(fix.root, entries)
    const row2 = result.rows.find((r) => r.label === 'Row label two')
    expect(row2?.fires).toBe(2)
    const row1 = result.rows.find((r) => r.label === 'Row label one')
    expect(row1?.fires).toBe(0)
    fix.cleanup()
  })

  it('R3: SKILL.md absent returns rows:[], skillInstalled:false', () => {
    const fix = makePhase4Fixture()
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(false)
    expect(result.rows).toHaveLength(0)
    fix.cleanup()
  })

  it('R4: SKILL.md exists but has no rationalization heading returns rows:[], skillInstalled:true', () => {
    const fix = makePhase4Fixture()
    fix.writeWorkflowSkill('# Workflow Skill\n\n## Some other section\n\ncontent\n')
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(true)
    expect(result.rows).toHaveLength(0)
    fix.cleanup()
  })

  it('R5: SKILL.md has heading but no table rows returns rows:[], skillInstalled:true', () => {
    const fix = makePhase4Fixture()
    fix.writeWorkflowSkill([
      '# Workflow Skill',
      '',
      '## Rationalization Table — Check Before Skipping Anything',
      '',
      'No table rows here.',
    ].join('\n'))
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(true)
    expect(result.rows).toHaveLength(0)
    fix.cleanup()
  })

  it('R6: canonical single-file layout (agentic-apps-workflow/SKILL.md) is detected', () => {
    const fix = makePhase4Fixture()
    fix.writeWorkflowSkillCanonical(SKILL_WITH_TABLE)
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(true)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]!.label).toBe('Row label one')
    fix.cleanup()
  })

  it('R7: canonical layout takes precedence when both layouts coexist', () => {
    const fix = makePhase4Fixture()
    // Bundle has 1-row table, canonical has 3-row table
    fix.writeWorkflowSkill([
      '# Bundle',
      '',
      '## Rationalization Table — Check Before Skipping Anything',
      '',
      '| If you think | Then remember |',
      '| --- | --- |',
      '| "Bundle row" | bundle |',
      '',
    ].join('\n'))
    fix.writeWorkflowSkillCanonical(SKILL_WITH_TABLE)
    const result = parseRationalizationRows(fix.root, [])
    expect(result.skillInstalled).toBe(true)
    // Canonical (3 rows) wins over bundle (1 row)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]!.label).toBe('Row label one')
    fix.cleanup()
  })
})


