import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkflowResponseSchema } from '@agenticapps/dashboard-shared'

import { scanWorkflowFleet } from './workflowScan.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workflow-scan-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function write(relativePath: string, content: string): void {
  const fullPath = join(tmpDir, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
}

describe('scanWorkflowFleet', () => {
  it('keeps every fixed host in order and states missing repositories', async () => {
    write(
      'agenticapps-workflow-core/spec/00-overview.md',
      '---\nspec_version: 1.0.0\n---\n',
    )
    write(
      'codex-workflow/skills/agentic-apps-workflow/SKILL.md',
      '---\nname: agentic-apps-workflow\nimplements_spec: 1.0.0\n---\n',
    )

    const result = await scanWorkflowFleet({
      sourceFamilyRoot: tmpDir,
      machineRoots: {
        'agenticapps-bin': join(tmpDir, 'missing-bin'),
        'claude-skills': join(tmpDir, 'missing-claude'),
        'codex-skills': join(tmpDir, 'missing-codex'),
        'opencode-skills': join(tmpDir, 'missing-opencode'),
        'pi-skills': join(tmpDir, 'missing-pi'),
      },
      now: () => new Date('2026-07-27T20:00:00.000Z'),
    })

    expect(() => WorkflowResponseSchema.parse(result)).not.toThrow()
    expect(result.core).toEqual({
      repoId: 'agenticapps-workflow-core',
      state: 'available',
      specVersion: '1.0.0',
    })
    expect(result.hosts.map(({ hostId, state }) => ({ hostId, state }))).toEqual([
      { hostId: 'claude-workflow', state: 'missing' },
      { hostId: 'codex-workflow', state: 'available' },
      { hostId: 'opencode-workflow', state: 'missing' },
      { hostId: 'pi-agentic-apps-workflow', state: 'missing' },
    ])
  })

  it('returns symbolic identifiers without fixture paths or registered product repos', async () => {
    const result = await scanWorkflowFleet({
      sourceFamilyRoot: tmpDir,
      machineRoots: {
        'agenticapps-bin': join(tmpDir, 'missing-bin'),
        'claude-skills': join(tmpDir, 'missing-claude'),
        'codex-skills': join(tmpDir, 'missing-codex'),
        'opencode-skills': join(tmpDir, 'missing-opencode'),
        'pi-skills': join(tmpDir, 'missing-pi'),
      },
    })
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain(tmpDir)
    expect(serialized).not.toContain('agenticapps-dashboard')
    expect(result.hosts).toHaveLength(4)
  })
})
