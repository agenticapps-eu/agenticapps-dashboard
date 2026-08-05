import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

import { WORKFLOW_FLEET } from './workflowFleetScanner.js'
import type {
  WorkflowArtifactId,
  WorkflowHostId,
} from './workflowFleetScanner.declare.js'
import {
  WORKFLOW_MACHINE_ROOTS,
  scanWorkflowHostArtifacts,
  scanWorkflowMachineRoot,
} from './workflowArtifactScanner.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workflow-artifacts-'))
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

function write(relativePath: string, content: string): void {
  const fullPath = join(tmpDir, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
}

const ARTIFACT_BYTES: Record<WorkflowArtifactId, string> = {
  'change-gate': '#!/bin/sh\n# gate-version: 1.2.2\nexit 0\n',
  'reviewer-cli': '#!/bin/sh\n# reviewer-cli-version: 1.0.0\nexit 0\n',
  'change-gate-harness': '#!/bin/sh\nexit 0\n',
  'reviewer-cli-harness': '#!/bin/sh\nexit 0\n',
}

function writeFleetArtifact(
  repoId: 'agenticapps-workflow-core' | WorkflowHostId,
  artifactId: WorkflowArtifactId,
  content = ARTIFACT_BYTES[artifactId],
): void {
  const entry = WORKFLOW_FLEET.find(({ id }) => id === repoId)!
  write(join(repoId, entry.artifacts[artifactId]), content)
}

function writeAllArtifacts(repoId: 'agenticapps-workflow-core' | WorkflowHostId): void {
  for (const artifactId of Object.keys(ARTIFACT_BYTES) as WorkflowArtifactId[]) {
    writeFleetArtifact(repoId, artifactId)
  }
}

describe('scanWorkflowHostArtifacts', () => {
  it('reads markers, hashes all four artifacts, and reports the offered migration head', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeAllArtifacts('codex-workflow')
    write('codex-workflow/migrations/0009-older.md', '# migration\n')
    write('codex-workflow/migrations/0015-newest.md', '# migration\n')
    write('codex-workflow/migrations/README.md', '# migrations\n')

    const result = scanWorkflowHostArtifacts(
      'codex-workflow',
      join(tmpDir, 'codex-workflow'),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )

    expect(result.artifacts.map(({ artifactId, state }) => ({ artifactId, state }))).toEqual([
      { artifactId: 'change-gate', state: 'identical' },
      { artifactId: 'reviewer-cli', state: 'identical' },
      { artifactId: 'change-gate-harness', state: 'identical' },
      { artifactId: 'reviewer-cli-harness', state: 'identical' },
    ])
    expect(result.artifacts[0]?.marker).toEqual({
      state: 'valid',
      version: '1.2.2',
    })
    expect(result.artifacts[1]?.marker).toEqual({
      state: 'valid',
      version: '1.0.0',
    })
    expect(result.artifacts[2]?.marker).toEqual({
      state: 'not-applicable',
      version: null,
    })
    expect(result.artifacts[0]?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.migration).toEqual({ kind: 'offered', highest: '0015' })
  })

  it('reports divergent bytes even when the version marker matches core', () => {
    writeFleetArtifact('agenticapps-workflow-core', 'change-gate')
    writeFleetArtifact(
      'codex-workflow',
      'change-gate',
      '#!/bin/sh\n# gate-version: 1.2.2\necho altered\n',
    )

    const result = scanWorkflowHostArtifacts(
      'codex-workflow',
      join(tmpDir, 'codex-workflow'),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )
    const gate = result.artifacts.find(({ artifactId }) => artifactId === 'change-gate')

    expect(gate?.marker).toEqual({ state: 'valid', version: '1.2.2' })
    expect(gate?.state).toBe('divergent')
  })

  it('keeps absent provenance independent from byte identity', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeAllArtifacts('codex-workflow')

    const result = scanWorkflowHostArtifacts(
      'codex-workflow',
      join(tmpDir, 'codex-workflow'),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )

    expect(result.artifacts.every(({ state }) => state === 'identical')).toBe(true)
    expect(
      result.artifacts.every(({ provenance }) => provenance.state === 'absent'),
    ).toBe(true)
  })

  it('accepts only a full SHA for a manifest entry covering the artifact', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeAllArtifacts('codex-workflow')
    const fullSha = '60cd83f8d236b4ef8646976f547e17edafb53eeb'
    const hostEntry = WORKFLOW_FLEET.find(({ id }) => id === 'codex-workflow')!
    const fileRows = Object.values(hostEntry.artifacts)
      .map((path) => `file=${path} sha256=${'a'.repeat(64)}`)
      .join('\n')
    write(
      'codex-workflow/tools/core-vendor.manifest',
      `core_commit=${fullSha}\n${fileRows}\n`,
    )

    const valid = scanWorkflowHostArtifacts(
      'codex-workflow',
      join(tmpDir, 'codex-workflow'),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )
    expect(
      valid.artifacts.every(
        ({ provenance }) =>
          provenance.state === 'valid' && provenance.commit === fullSha,
      ),
    ).toBe(true)

    write(
      'codex-workflow/tools/core-vendor.manifest',
      `core_commit=60cd83f\n${fileRows}\n`,
    )
    const invalid = scanWorkflowHostArtifacts(
      'codex-workflow',
      join(tmpDir, 'codex-workflow'),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )
    expect(
      invalid.artifacts.every(
        ({ provenance }) =>
          provenance.state === 'invalid' && provenance.commit === null,
      ),
    ).toBe(true)
  })

  it('reports all four mapped hosts green when their current copies match core', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    const hostIds: WorkflowHostId[] = [
      'claude-workflow',
      'codex-workflow',
      'opencode-workflow',
      'pi-agentic-apps-workflow',
    ]
    for (const hostId of hostIds) writeAllArtifacts(hostId)

    const results = hostIds.map((hostId) =>
      scanWorkflowHostArtifacts(
        hostId,
        join(tmpDir, hostId),
        join(tmpDir, 'agenticapps-workflow-core'),
        makeResolver(tmpDir),
      ),
    )

    expect(
      results.every(({ artifacts }) =>
        artifacts.every(({ state }) => state === 'identical'),
      ),
    ).toBe(true)
  })
})

describe('scanWorkflowMachineRoot', () => {
  it('uses five separate symbolic machine roots', () => {
    expect(WORKFLOW_MACHINE_ROOTS).toEqual([
      { id: 'agenticapps-bin', kind: 'artifacts' },
      {
        id: 'claude-skills',
        kind: 'skills',
        hostId: 'claude-workflow',
        skillTargetNames: {
          'agentic-apps-workflow': ['skill'],
          'setup-agenticapps-workflow': ['setup'],
          'update-agenticapps-workflow': ['update'],
        },
      },
      { id: 'codex-skills', kind: 'skills', hostId: 'codex-workflow' },
      { id: 'opencode-skills', kind: 'skills', hostId: 'opencode-workflow' },
      {
        id: 'pi-skills',
        kind: 'skills',
        hostId: 'pi-agentic-apps-workflow',
      },
    ])
  })

  it('states absence plainly and reports machine-wide entries separately', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    mkdirSync(join(tmpDir, 'agenticapps-bin'))
    write(
      'agenticapps-bin/openspec-change-gate.sh',
      ARTIFACT_BYTES['change-gate'],
    )
    mkdirSync(join(tmpDir, 'codex-skills', 'agentic-apps-workflow'), {
      recursive: true,
    })
    mkdirSync(join(tmpDir, 'claude-target', 'skill'), { recursive: true })
    mkdirSync(join(tmpDir, 'claude-skills'))
    symlinkSync(
      join(tmpDir, 'claude-target', 'skill'),
      join(tmpDir, 'claude-skills', 'agentic-apps-workflow'),
    )

    const binaries = scanWorkflowMachineRoot(
      'agenticapps-bin',
      join(tmpDir, 'agenticapps-bin'),
      makeResolver(tmpDir),
      { coreRepoRoot: join(tmpDir, 'agenticapps-workflow-core') },
    )
    expect(binaries.rootId).toBe('agenticapps-bin')
    expect(binaries.state).toBe('present')
    expect(
      binaries.entries.map(({ id, state, artifact }) => ({
        id,
        state,
        artifactState: artifact?.state,
      })),
    ).toEqual([
      {
        id: 'change-gate',
        state: 'present',
        artifactState: 'identical',
      },
      {
        id: 'reviewer-cli',
        state: 'missing',
        artifactState: 'missing',
      },
    ])
    expect(
      scanWorkflowMachineRoot(
        'claude-skills',
        join(tmpDir, 'claude-skills'),
        makeResolver(tmpDir),
        { expectedSkillIds: ['agentic-apps-workflow'] },
      ),
    ).toEqual({
      rootId: 'claude-skills',
      state: 'present',
      entries: [{ id: 'agentic-apps-workflow', state: 'present' }],
    })
    expect(
      scanWorkflowMachineRoot(
        'codex-skills',
        join(tmpDir, 'codex-skills'),
        makeResolver(tmpDir),
        {
          expectedSkillIds: ['agentic-apps-workflow', 'codex-qa'],
        },
      ),
    ).toEqual({
      rootId: 'codex-skills',
      state: 'present',
      entries: [
        { id: 'agentic-apps-workflow', state: 'present' },
        { id: 'codex-qa', state: 'missing' },
      ],
    })
    expect(
      scanWorkflowMachineRoot(
        'pi-skills',
        join(tmpDir, 'missing-pi-skills'),
        makeResolver(tmpDir),
        { expectedSkillIds: ['agentic-apps-workflow'] },
      ),
    ).toEqual({
      rootId: 'pi-skills',
      state: 'absent',
      entries: [],
    })
  })
})

describe('pinned artefacts', () => {
  const PIN_COMMIT = '6cd3b9c40eb409ab1b256e3b9e8d50c7268538ab'

  function sha256Of(content: string): string {
    return createHash('sha256').update(Buffer.from(content)).digest('hex')
  }

  /**
   * A pin manifest as claude-workflow actually writes one. `keyFor` exists
   * because the manifest's entry keys are NOT paths in core: the real file
   * records `file=bin/openspec-change-gate.sh`, which core does not have.
   */
  function writeManifest(
    hostId: WorkflowHostId,
    options: {
      commit?: string
      commitLines?: string[]
      omit?: readonly WorkflowArtifactId[]
      digests?: Partial<Record<WorkflowArtifactId, string>>
    } = {},
  ): void {
    const hostEntry = WORKFLOW_FLEET.find(({ id }) => id === hostId)!
    const omit = new Set(options.omit ?? [])
    const rows = (Object.keys(ARTIFACT_BYTES) as WorkflowArtifactId[])
      .filter((artifactId) => !omit.has(artifactId))
      .map((artifactId) => {
        const digest =
          options.digests?.[artifactId] ?? sha256Of(ARTIFACT_BYTES[artifactId])
        return `file=${hostEntry.artifacts[artifactId]} sha256=${digest}`
      })
    const commitLines =
      options.commitLines ?? [`core_commit=${options.commit ?? PIN_COMMIT}`]
    write(
      join(hostId, 'tools/core-vendor.manifest'),
      `core_repo=agenticapps-eu/agenticapps-workflow-core\n${commitLines.join('\n')}\n${rows.join('\n')}\n`,
    )
  }

  function scan(hostId: WorkflowHostId) {
    return scanWorkflowHostArtifacts(
      hostId,
      join(tmpDir, hostId),
      join(tmpDir, 'agenticapps-workflow-core'),
      makeResolver(tmpDir),
    )
  }

  it('reports a pinning host as pinned, not missing', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeManifest('claude-workflow')

    const gate = scan('claude-workflow').artifacts.find(
      ({ artifactId }) => artifactId === 'change-gate',
    )

    expect(gate?.state).toBe('pinned')
    expect(gate?.pin).toEqual({
      state: 'intact',
      commit: PIN_COMMIT,
      recordedSha256: sha256Of(ARTIFACT_BYTES['change-gate']),
    })
  })

  it('never reports a validly pinned artefact as absent, missing, or divergent', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeManifest('claude-workflow')

    const states = scan('claude-workflow').artifacts.map(({ state }) => state)

    expect(states).toEqual(['pinned', 'pinned', 'pinned', 'pinned'])
    expect(states).not.toContain('missing')
    expect(states).not.toContain('divergent')
  })

  it('reports a digest that differs from the current reference as behind, not dishonest', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeManifest('claude-workflow', {
      digests: { 'change-gate': 'b'.repeat(64) },
    })

    const gate = scan('claude-workflow').artifacts.find(
      ({ artifactId }) => artifactId === 'change-gate',
    )
    const reviewer = scan('claude-workflow').artifacts.find(
      ({ artifactId }) => artifactId === 'reviewer-cli',
    )

    // Behind, because a stale pin and a wrong pin are indistinguishable
    // without the historical read this change does not perform.
    expect(gate?.pin.state).toBe('behind')
    expect(gate?.pin.commit).toBe(PIN_COMMIT)
    // The manifest is internally consistent; that must not raise the result.
    expect(reviewer?.pin.state).toBe('intact')
  })

  it('reports an artefact the host publishes but the manifest omits', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeManifest('claude-workflow', { omit: ['reviewer-cli'] })

    const artifacts = scan('claude-workflow').artifacts
    const reviewer = artifacts.find(({ artifactId }) => artifactId === 'reviewer-cli')
    const gate = artifacts.find(({ artifactId }) => artifactId === 'change-gate')

    expect(reviewer?.pin.state).toBe('unlisted')
    expect(reviewer?.state).toBe('missing')
    // Entries that are present do not compensate for the one that is absent.
    expect(gate?.pin.state).toBe('intact')
  })

  it('treats a malformed or multiply-declared commit as an invalid pin', () => {
    writeAllArtifacts('agenticapps-workflow-core')

    writeManifest('claude-workflow', { commit: '6cd3b9c' })
    expect(scan('claude-workflow').artifacts[0]?.pin).toEqual({
      state: 'invalid',
      commit: null,
      recordedSha256: null,
    })

    writeManifest('claude-workflow', {
      commitLines: [`core_commit=${PIN_COMMIT}`, `core_commit=${'f'.repeat(40)}`],
    })
    expect(scan('claude-workflow').artifacts[0]?.pin.state).toBe('invalid')
  })

  it('does not penalise a manifest key that has no counterpart in core', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeManifest('claude-workflow')

    // The manifest names host publish targets. `bin/openspec-change-gate.sh`
    // does not exist in core — core's copy lives under
    // reference-implementations/ — and that must not produce a finding.
    const coreEntry = WORKFLOW_FLEET.find(
      ({ id }) => id === 'agenticapps-workflow-core',
    )!
    const hostEntry = WORKFLOW_FLEET.find(({ id }) => id === 'claude-workflow')!
    expect(hostEntry.artifacts['change-gate']).not.toBe(
      coreEntry.artifacts['change-gate'],
    )
    expect(scan('claude-workflow').artifacts[0]?.pin.state).toBe('intact')
  })

  it('raises no pin finding against a host that vendors', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeAllArtifacts('codex-workflow')

    const artifacts = scan('codex-workflow').artifacts

    expect(artifacts.every(({ state }) => state === 'identical')).toBe(true)
    expect(artifacts.every(({ pin }) => pin.state === 'not-declared')).toBe(true)
  })

  it('keeps a vendored copy divergent when it lags core, pin or no pin', () => {
    writeFleetArtifact('agenticapps-workflow-core', 'change-gate')
    writeFleetArtifact(
      'pi-agentic-apps-workflow',
      'change-gate',
      '#!/bin/sh\n# gate-version: 1.3.1\nexit 0\n',
    )

    const gate = scan('pi-agentic-apps-workflow').artifacts.find(
      ({ artifactId }) => artifactId === 'change-gate',
    )

    expect(gate?.state).toBe('divergent')
    expect(gate?.marker).toEqual({ state: 'valid', version: '1.3.1' })
  })

  it('lets a present local copy decide the state even when a pin also covers it', () => {
    writeAllArtifacts('agenticapps-workflow-core')
    writeAllArtifacts('claude-workflow')
    writeManifest('claude-workflow')

    const gate = scan('claude-workflow').artifacts.find(
      ({ artifactId }) => artifactId === 'change-gate',
    )

    expect(gate?.state).toBe('identical')
    expect(gate?.pin.state).toBe('intact')
  })
})
