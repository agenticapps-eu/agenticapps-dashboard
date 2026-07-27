import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkflowResponse } from '@agenticapps/dashboard-shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/workflowQueries.js', () => ({
  useWorkflow: vi.fn(),
  useRunWorkflowHarness: vi.fn(),
}))

import { useRunWorkflowHarness, useWorkflow } from '../../lib/workflowQueries.js'

import { WorkflowPage } from './WorkflowPage.js'

const mockUseWorkflow = vi.mocked(useWorkflow)
const mockUseRunWorkflowHarness = vi.mocked(useRunWorkflowHarness)

type WorkflowHost = WorkflowResponse['hosts'][number]
type WorkflowArtifact = WorkflowHost['artifacts'][number]

function artifact(artifactId: WorkflowArtifact['artifactId']): WorkflowArtifact {
  const script = artifactId === 'change-gate' || artifactId === 'reviewer-cli'
  return {
    artifactId,
    state: 'identical',
    sha256: 'a'.repeat(64),
    referenceSha256: 'a'.repeat(64),
    marker: {
      state: script ? 'valid' : 'not-applicable',
      version:
        artifactId === 'change-gate' ? '1.2.2' : artifactId === 'reviewer-cli' ? '1.0.0' : null,
    },
    provenance: { state: 'absent', commit: null },
  }
}

function host(hostId: WorkflowHost['hostId'], laggardVersion: string | null): WorkflowHost {
  const primary = {
    id: 'agentic-apps-workflow',
    name: 'agentic-apps-workflow',
    state: 'known' as const,
    version: '1.0.0',
  }
  const laggards = laggardVersion
    ? [
        {
          id: 'observability',
          name: 'observability',
          version: laggardVersion,
        },
      ]
    : []
  return {
    hostId,
    state: 'available',
    primary,
    skills: [primary],
    minimum: laggardVersion ?? '1.0.0',
    maximum: '1.0.0',
    laggards,
    unknowns: [],
    internallyConsistent: laggards.length === 0,
    coreState: 'current',
    divergent: laggards.length > 0,
    artifacts: [
      artifact('change-gate'),
      artifact('reviewer-cli'),
      artifact('change-gate-harness'),
      artifact('reviewer-cli-harness'),
    ],
    migration: { kind: 'offered', highest: '0032' },
  }
}

function data(): WorkflowResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: '2026-07-26T09:12:00.000Z',
    core: {
      repoId: 'agenticapps-workflow-core',
      state: 'available',
      specVersion: '1.0.0',
    },
    hosts: [
      host('claude-workflow', '0.4.0'),
      host('codex-workflow', '0.4.0'),
      host('opencode-workflow', null),
      host('pi-agentic-apps-workflow', '0.10.0'),
    ],
    machineRoots: [
      {
        rootId: 'agenticapps-bin',
        state: 'present',
        entries: [
          {
            id: 'change-gate',
            state: 'present',
            artifact: artifact('change-gate'),
          },
          {
            id: 'reviewer-cli',
            state: 'present',
            artifact: artifact('reviewer-cli'),
          },
        ],
      },
      { rootId: 'claude-skills', state: 'present', entries: [] },
      { rootId: 'codex-skills', state: 'present', entries: [] },
      { rootId: 'opencode-skills', state: 'present', entries: [] },
      { rootId: 'pi-skills', state: 'present', entries: [] },
    ],
  }
}

const mutateAsync = vi.fn()

beforeEach(() => {
  mutateAsync.mockReset()
  mockUseWorkflow.mockReset()
  mockUseRunWorkflowHarness.mockReset()
  mockUseWorkflow.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    data: data(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useWorkflow>)
  mockUseRunWorkflowHarness.mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useRunWorkflowHarness>)
})

describe('WorkflowPage', () => {
  it('renders the three instrument blocks and fixed five-repository scope', () => {
    render(<WorkflowPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Workflow fleet' })).toBeTruthy()
    expect(screen.getByText('Spec conformance')).toBeTruthy()
    expect(screen.getByText('Shared artefacts')).toBeTruthy()
    expect(screen.getByText('Harness results')).toBeTruthy()
    expect(screen.getByText('Core spec 1.0.0')).toBeTruthy()
    for (const hostId of [
      'claude-workflow',
      'codex-workflow',
      'opencode-workflow',
      'pi-agentic-apps-workflow',
    ]) {
      expect(screen.getAllByText(hostId).length).toBeGreaterThan(0)
    }
  })

  it('shows range, migration position, and expandable named laggards', () => {
    render(<WorkflowPage />)

    expect(screen.getAllByText('0.4.0–1.0.0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Offered 0032').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 laggard/).some((node) => node.closest('details'))).toBe(true)
    expect(screen.getAllByText('observability · 0.4.0').length).toBeGreaterThan(0)
  })

  it('shows byte identity, vendor provenance, and machine-wide state', () => {
    render(<WorkflowPage />)

    expect(screen.getByText('Change gate')).toBeTruthy()
    expect(screen.getByText('Reviewer CLI')).toBeTruthy()
    expect(screen.getAllByText('Identical').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Absent').length).toBe(4)
    expect(screen.getByText('Machine-wide tools')).toBeTruthy()
    expect(screen.getByText('change-gate · 1.2.2')).toBeTruthy()
    expect(screen.getByText('reviewer-cli · 1.0.0')).toBeTruthy()
  })

  it('keeps both measured findings visible without a filter or interaction', () => {
    render(<WorkflowPage />)

    expect(screen.getAllByText('0.4.0–1.0.0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Absent').length).toBe(4)
    expect(screen.queryByRole('button', { name: /filter/i })).toBeNull()
  })

  it('starts no harness while rendering and shows explicit empty states', () => {
    render(<WorkflowPage />)

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(screen.getAllByText('No current result')).toHaveLength(8)
    expect(screen.getAllByRole('button', { name: /^Run / })).toHaveLength(8)
  })

  it('runs only the selected harness and renders its exit-status result with age', async () => {
    mutateAsync.mockResolvedValue({
      schemaVersion: 1,
      hostId: 'codex-workflow',
      harnessId: 'change-gate',
      state: 'completed',
      passed: false,
      completedAtIso: '2026-07-27T20:00:00.000Z',
      ageMs: 65_000,
      output: 'one assertion failed',
      cached: true,
    })
    render(<WorkflowPage />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Run change gate for codex-workflow',
      }),
    )

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        hostId: 'codex-workflow',
        harnessId: 'change-gate',
      }),
    )
    expect(await screen.findByText('Failed · 1m ago')).toBeTruthy()
    expect(screen.getByText('one assertion failed')).toBeTruthy()
    expect(screen.queryByText(/\/28|\/12/)).toBeNull()
  })

  it('renders generic loading, schema-drift, and transport error states', () => {
    mockUseWorkflow.mockReturnValue({
      isPending: true,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflow>)
    const { rerender } = render(<WorkflowPage />)
    expect(screen.getByLabelText('Loading workflow fleet')).toBeTruthy()

    mockUseWorkflow.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('schema_drift:hosts.0'),
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflow>)
    rerender(<WorkflowPage />)
    expect(screen.getByText('Schema drift detected')).toBeTruthy()

    mockUseWorkflow.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('/Users/private/workflow.json'),
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflow>)
    rerender(<WorkflowPage />)
    expect(screen.getByText('Could not load workflow data.')).toBeTruthy()
    expect(screen.queryByText('/Users/private/workflow.json')).toBeNull()
  })
})

describe('WorkflowPage source guards', () => {
  it('does not parse score-shaped harness output or render raw paths', async () => {
    const source = await import('./WorkflowPage.tsx?raw').then((module) => module.default)

    expect(source).not.toMatch(/n\/28|n\/12/)
    expect(source).not.toContain(`dangerously${'Set'}InnerHTML`)
  })
})
