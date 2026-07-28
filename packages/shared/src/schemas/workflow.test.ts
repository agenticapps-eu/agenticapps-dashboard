import { describe, expect, it } from 'vitest'

import {
  WorkflowHarnessRequestSchema,
  WorkflowHarnessResultSchema,
  WorkflowResponseSchema,
  type WorkflowHarnessResult,
  type WorkflowResponse,
} from './workflow.js'

function missingHost(
  hostId: WorkflowResponse['hosts'][number]['hostId'],
): WorkflowResponse['hosts'][number] {
  return {
    hostId,
    state: 'missing',
    primary: null,
    skills: [],
    minimum: null,
    maximum: null,
    laggards: [],
    unknowns: [],
    internallyConsistent: false,
    coreState: 'unavailable',
    divergent: true,
    artifacts: [],
    migration: { kind: 'offered', highest: null },
  }
}

function validResponse(): WorkflowResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: '2026-07-27T20:00:00.000Z',
    core: {
      repoId: 'agenticapps-workflow-core',
      state: 'missing',
      specVersion: null,
    },
    hosts: [
      missingHost('claude-workflow'),
      missingHost('codex-workflow'),
      missingHost('opencode-workflow'),
      missingHost('pi-agentic-apps-workflow'),
    ],
    machineRoots: [
      { rootId: 'agenticapps-bin', state: 'absent', entries: [] },
      { rootId: 'claude-skills', state: 'absent', entries: [] },
      { rootId: 'codex-skills', state: 'absent', entries: [] },
      { rootId: 'opencode-skills', state: 'absent', entries: [] },
      { rootId: 'pi-skills', state: 'absent', entries: [] },
    ],
  }
}

describe('WorkflowResponseSchema', () => {
  it('accepts the fixed workflow fleet in order', () => {
    expect(WorkflowResponseSchema.parse(validResponse())).toEqual(validResponse())
  })

  it('rejects a registered product repository in the host matrix', () => {
    const response = validResponse() as unknown as {
      hosts: Array<Record<string, unknown>>
    }
    response.hosts[0]!.hostId = 'agenticapps-dashboard'

    expect(() => WorkflowResponseSchema.parse(response)).toThrow()
  })

  it('rejects absolute filesystem paths in symbolic identifier fields', () => {
    const response = validResponse()
    response.hosts[0]!.skills = [
      {
        id: '/Users/example/secret',
        name: 'secret',
        state: 'known',
        version: '1.0.0',
      },
    ]

    expect(() => WorkflowResponseSchema.parse(response)).toThrow()
  })
})

describe('workflow harness wire schemas', () => {
  const completed: WorkflowHarnessResult = {
    schemaVersion: 1,
    hostId: 'codex-workflow',
    harnessId: 'change-gate',
    state: 'completed',
    passed: true,
    completedAtIso: '2026-07-27T20:00:00.000Z',
    ageMs: 0,
    output: '21 passed',
    cached: false,
  }

  it('accepts only a fixed host and harness selection', () => {
    expect(
      WorkflowHarnessRequestSchema.parse({
        hostId: 'codex-workflow',
        harnessId: 'change-gate',
      }),
    ).toEqual({
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
    })

    expect(() =>
      WorkflowHarnessRequestSchema.parse({
        hostId: 'unknown-host',
        harnessId: 'change-gate',
      }),
    ).toThrow()
    expect(() =>
      WorkflowHarnessRequestSchema.parse({
        hostId: 'codex-workflow',
        harnessId: 'arbitrary-command',
      }),
    ).toThrow()
  })

  it.each(['root', 'path', 'argv', 'cwd', 'env'] as const)(
    'rejects a request-controlled %s field',
    (field) => {
      expect(() =>
        WorkflowHarnessRequestSchema.parse({
          hostId: 'codex-workflow',
          harnessId: 'change-gate',
          [field]: '/tmp/attacker-controlled',
        }),
      ).toThrow()
    },
  )

  it('accepts completed and bounded terminal results', () => {
    expect(WorkflowHarnessResultSchema.parse(completed)).toEqual(completed)
    expect(
      WorkflowHarnessResultSchema.parse({
        ...completed,
        state: 'timeout',
        passed: null,
        completedAtIso: null,
        ageMs: null,
        output: '',
        reason: 'time-limit',
      }),
    ).toMatchObject({ state: 'timeout', reason: 'time-limit' })
  })

  it('enforces completed versus incomplete result invariants', () => {
    expect(() =>
      WorkflowHarnessResultSchema.parse({
        ...completed,
        passed: null,
      }),
    ).toThrow()
    expect(() =>
      WorkflowHarnessResultSchema.parse({
        ...completed,
        state: 'timeout',
        reason: 'time-limit',
      }),
    ).toThrow()
    expect(() =>
      WorkflowHarnessResultSchema.parse({
        ...completed,
        state: 'busy',
        passed: null,
        completedAtIso: null,
        ageMs: null,
      }),
    ).toThrow()
  })
})
