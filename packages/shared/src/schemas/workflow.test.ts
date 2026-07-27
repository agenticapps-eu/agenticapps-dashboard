import { describe, expect, it } from 'vitest'

import {
  WorkflowResponseSchema,
  type WorkflowResponse,
} from './workflow.declare.js'

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
