import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { basename, join, sep } from 'node:path'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { PathViolation, makeCoverageResolver } from '../coverageResolver.js'
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

  it('ignores non-directory and hidden entries in a directory skill root', () => {
    writeSkill(
      'skills/agentic-apps-workflow/SKILL.md',
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )
    writeFileSync(join(tmpDir, 'skills', 'README.md'), '# Skills\n')
    writeFileSync(join(tmpDir, 'skills', '.DS_Store'), 'metadata')

    const result = scanWorkflowHostSkills(
      'codex-workflow',
      tmpDir,
      '1.0.0',
      makeResolver(tmpDir),
    )

    expect(result.skills.map(({ id }) => id)).toEqual([
      'agentic-apps-workflow',
    ])
    expect(result.internallyConsistent).toBe(true)
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

// ─────────────────────────────────────────────────────────────────────────────
// anchor-allowed-subdirs-to-root tasks 4.3 and 4.4.
//
// These use the REAL resolver and the production directory layout — repos under
// a family root — on purpose. makeResolver() above bounds everything to one
// root and ignores opts, so an escape test written against it would pass
// whether or not the call site anchors. And with the repos placed outside the
// family roots, the merged family allowance never fires and the test would
// again prove nothing. Only this shape exercises what the fleet actually does.
// ─────────────────────────────────────────────────────────────────────────────

describe('scanWorkflowHostSkills — escaping skill directories', () => {
  function makeFleetLayout(): {
    repo: string
    otherRepo: string
    resolve: PathResolver
  } {
    const sourcecodeRoot = join(tmpDir, 'Sourcecode')
    const family = join(sourcecodeRoot, 'agenticapps')
    const repo = join(family, 'codex-workflow')
    const otherRepo = join(family, 'other-repo')
    mkdirSync(join(repo, 'skills'), { recursive: true })
    mkdirSync(otherRepo, { recursive: true })
    return { repo, otherRepo, resolve: makeCoverageResolver({ sourcecodeRoot }) }
  }

  function writeSkillAt(fullPath: string, name: string, declarations: string[]): void {
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(
      fullPath,
      `---\nname: ${name}\n${declarations.join('\n')}\n---\n\n# ${name}\n`,
    )
  }

  // Task 4.3 — the skill DIRECTORY under skills/ is a symlink to another repo.
  it('does not adopt a skill directory symlinked into a sibling repository', () => {
    const { repo, otherRepo, resolve } = makeFleetLayout()
    // The target directory carries the SAME basename, so the name check passes
    // and the anchor is the only thing that can refuse this.
    writeSkillAt(
      join(otherRepo, 'agentic-apps-workflow', 'SKILL.md'),
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )
    symlinkSync(
      join(otherRepo, 'agentic-apps-workflow'),
      join(repo, 'skills', 'agentic-apps-workflow'),
      'dir',
    )

    const result = scanWorkflowHostSkills('codex-workflow', repo, '1.0.0', resolve)

    const primary = result.skills.find((s) => s.id === 'agentic-apps-workflow')
    expect(primary?.version).toBeNull()
  })

  // Task 4.4 — the skill directory is genuine; SKILL.md inside it is the
  // symlink. Anchoring to skillRoot alone would still admit this, because the
  // target sits under a family root. The anchor must name the repository.
  it('does not read a SKILL.md symlinked into a sibling repository', () => {
    const { repo, otherRepo, resolve } = makeFleetLayout()
    writeSkillAt(join(otherRepo, 'SKILL.md'), 'agentic-apps-workflow', [
      'implements_spec: 1.0.0',
    ])
    mkdirSync(join(repo, 'skills', 'agentic-apps-workflow'), { recursive: true })
    symlinkSync(
      join(otherRepo, 'SKILL.md'),
      join(repo, 'skills', 'agentic-apps-workflow', 'SKILL.md'),
    )

    const result = scanWorkflowHostSkills('codex-workflow', repo, '1.0.0', resolve)

    const primary = result.skills.find((s) => s.id === 'agentic-apps-workflow')
    expect(primary?.version).toBeNull()
  })

  // Found by the codex reviewer in round 2, and missed by the tests above: they
  // symlink a skill directory *under* skills/, so they never exercise skills/
  // ITSELF being the symlink. That resolution is unanchored, so the family roots
  // admit it, and the directory is then enumerated — foreign entry names reach
  // the output as skill ids before any child read is anchored.
  it('does not enumerate a skills root symlinked into a sibling repository', () => {
    const { repo, otherRepo, resolve } = makeFleetLayout()
    mkdirSync(join(otherRepo, 'skills', 'not-this-repos-skill'), { recursive: true })
    writeSkillAt(
      join(otherRepo, 'skills', 'not-this-repos-skill', 'SKILL.md'),
      'not-this-repos-skill',
      ['implements_spec: 1.0.0'],
    )
    rmSync(join(repo, 'skills'), { recursive: true, force: true })
    symlinkSync(join(otherRepo, 'skills'), join(repo, 'skills'), 'dir')

    const result = scanWorkflowHostSkills('codex-workflow', repo, '1.0.0', resolve)

    const surfaced = [
      ...result.skills.map((s) => s.id),
      ...result.unknowns.map((u) => u.id),
    ]
    expect(surfaced).not.toContain('not-this-repos-skill')
  })

  it('control — an ordinary in-repo skill directory is read normally', () => {
    const { repo, resolve } = makeFleetLayout()
    writeSkillAt(
      join(repo, 'skills', 'agentic-apps-workflow', 'SKILL.md'),
      'agentic-apps-workflow',
      ['implements_spec: 1.0.0'],
    )

    const result = scanWorkflowHostSkills('codex-workflow', repo, '1.0.0', resolve)

    const primary = result.skills.find((s) => s.id === 'agentic-apps-workflow')
    expect(primary?.version).toBe('1.0.0')
  })
})
