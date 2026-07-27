import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { basename, join, sep } from 'node:path'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'
import {
  WORKFLOW_FLEET,
  requireWorkflowRepoId,
  scanWorkflowHostSkills,
} from './workflowFleetScanner.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workflow-fleet-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeResolver(root: string): PathResolver {
  return (candidatePath, opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }

    const realRoot = realpathSync(root)
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed root: ${real}`)
    }

    const name = basename(real)
    if (opts.allowedNames && !opts.allowedNames.includes(name)) {
      throw new PathViolation(`name not allowed: ${name}`)
    }
    if (opts.extension && !name.endsWith(opts.extension)) {
      throw new PathViolation(`extension not allowed: ${name}`)
    }
    return real
  }
}

function writeSkill(
  relativePath: string,
  name: string,
  declarations: string[],
): void {
  const fullPath = join(tmpDir, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(
    fullPath,
    `---\nname: ${name}\n${declarations.join('\n')}\n---\n\n# ${name}\n`,
  )
}

describe('WORKFLOW_FLEET', () => {
  it('fixes the five repositories and all shared artifact mappings', () => {
    expect(WORKFLOW_FLEET.map((entry) => entry.id)).toEqual([
      'agenticapps-workflow-core',
      'claude-workflow',
      'codex-workflow',
      'opencode-workflow',
      'pi-agentic-apps-workflow',
    ])

    expect(WORKFLOW_FLEET[0]?.artifacts).toEqual({
      'change-gate':
        'reference-implementations/openspec-change-gate/openspec-change-gate.sh',
      'reviewer-cli': 'reference-implementations/reviewer-cli/reviewer-cli.sh',
      'change-gate-harness': 'tools/change-gate-conformance.sh',
      'reviewer-cli-harness': 'tools/reviewer-cli-conformance.sh',
    })
    for (const host of WORKFLOW_FLEET.slice(1)) {
      expect(host.artifacts).toEqual({
        'change-gate': 'bin/openspec-change-gate.sh',
        'reviewer-cli': 'bin/reviewer-cli.sh',
        'change-gate-harness': 'tools/change-gate-conformance.sh',
        'reviewer-cli-harness': 'tools/reviewer-cli-conformance.sh',
      })
      expect(host.provenanceManifest).toBe('tools/core-vendor.manifest')
    }
  })

  it('rejects an identifier outside the fixed fleet', () => {
    expect(() => requireWorkflowRepoId('other-workflow')).toThrow(
      'unknown workflow repository identifier',
    )
  })
})

describe('scanWorkflowHostSkills', () => {
  it('reports drift when the primary matches core but another skill trails', () => {
    writeSkill(
      'skills/agentic-apps-workflow/SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )
    writeSkill('skills/codex-qa/SKILL.md', 'codex-qa', [
      'implements_spec: 0.4.0',
    ])

    const result = scanWorkflowHostSkills(
      'codex-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
    )

    expect(result.primary.version).toBe('1.0.0')
    expect(result.minimum).toBe('0.4.0')
    expect(result.maximum).toBe('1.0.0')
    expect(result.coreState).toBe('current')
    expect(result.internallyConsistent).toBe(false)
    expect(result.divergent).toBe(true)
    expect(result.laggards).toEqual([
      { id: 'codex-qa', name: 'codex-qa', version: '0.4.0' },
    ])
  })

  it('reports equal minimum and maximum for a drift-free host', () => {
    writeSkill(
      'skills/agentic-apps-workflow/SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )
    writeSkill('skills/opencode-qa/SKILL.md', 'opencode-qa', [
      'implements_spec: 1.0.0',
    ])

    const result = scanWorkflowHostSkills(
      'opencode-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
    )

    expect(result.minimum).toBe('1.0.0')
    expect(result.maximum).toBe('1.0.0')
    expect(result.internallyConsistent).toBe(true)
    expect(result.divergent).toBe(false)
  })

  it('keeps an explained older pin divergent from core', () => {
    writeSkill(
      'skills/agentic-apps-workflow/SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 0.9.0'],
    )
    writeSkill('skills/codex-qa/SKILL.md', 'codex-qa', [
      'implements_spec: 0.9.0',
    ])

    const result = scanWorkflowHostSkills(
      'codex-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
      { explanationId: 'ADR-0042' },
    )

    expect(result.explanationId).toBe('ADR-0042')
    expect(result.internallyConsistent).toBe(true)
    expect(result.coreState).toBe('behind')
    expect(result.divergent).toBe(true)
  })

  it('reports missing, duplicate, and malformed declarations explicitly', () => {
    writeSkill(
      'skills/agentic-apps-workflow/SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )
    writeSkill('skills/codex-missing/SKILL.md', 'codex-missing', [])
    writeSkill('skills/codex-duplicate/SKILL.md', 'codex-duplicate', [
      'implements_spec: 0.4.0',
      'implements_spec: 1.0.0',
    ])
    writeSkill('skills/codex-malformed/SKILL.md', 'codex-malformed', [
      'implements_spec: version-one',
    ])
    mkdirSync(join(tmpDir, 'skills', 'codex-absent'))

    const result = scanWorkflowHostSkills(
      'codex-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
    )

    expect(
      result.unknowns.map(({ id, state, reason }) => ({ id, state, reason })),
    ).toEqual([
      {
        id: 'codex-absent',
        state: 'missing',
        reason: 'expected-skill-missing',
      },
      {
        id: 'codex-duplicate',
        state: 'unknown',
        reason: 'implements-spec-duplicate',
      },
      {
        id: 'codex-malformed',
        state: 'unknown',
        reason: 'implements-spec-malformed',
      },
      {
        id: 'codex-missing',
        state: 'unknown',
        reason: 'implements-spec-missing',
      },
    ])
    expect(result.internallyConsistent).toBe(false)
  })

  it('includes every explicit Claude skill location, including the snapshot', () => {
    writeSkill('skill/SKILL.md', 'agentic-apps-workflow', [
      'implements_spec: 1.0.0',
    ])
    writeSkill('setup/SKILL.md', 'setup-agenticapps-workflow', [
      'implements_spec: 1.0.0',
    ])
    writeSkill('update/SKILL.md', 'update-agenticapps-workflow', [
      'implements_spec: 1.0.0',
    ])
    writeSkill('ts-declare-first/SKILL.md', 'ts-declare-first', [
      'implements_spec: 0.4.0',
    ])
    writeSkill(
      'setup/snapshot/agentic-apps-workflow-SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )

    const result = scanWorkflowHostSkills(
      'claude-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
    )

    expect(result.skills.map((skill) => skill.id)).toEqual([
      'agentic-apps-workflow',
      'agentic-apps-workflow-snapshot',
      'setup-agenticapps-workflow',
      'ts-declare-first',
      'update-agenticapps-workflow',
    ])
    expect(result.laggards).toEqual([
      {
        id: 'ts-declare-first',
        name: 'ts-declare-first',
        version: '0.4.0',
      },
    ])
  })
})
