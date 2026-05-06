/**
 * CommitmentBlock.test.tsx — TDD tests for CommitmentBlock panel.
 *
 * Tests CB1–CB7:
 * CB1: data present → renders markdown verbatim in <pre> with spec classes
 * CB2: data present → renders 'Source: {filename}' line with spec classes
 * CB3: markdown null → renders empty-state copy verbatim
 * CB4: loading → renders 'Loading...' line
 * CB5: schema_drift error → renders inline drift state with path visible
 * CB6: other error → renders PanelContainer in unreachable state
 * CB7: panel title is 'Commitment'
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { CommitmentBlockResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(),
  useObservations: vi.fn(),
  useDiscipline: vi.fn(),
}))

import { useCommitment } from '../../lib/projectQueries.js'

import { CommitmentBlock } from './CommitmentBlock.js'

type MockQueryResult = Partial<UseQueryResult<CommitmentBlockResponse, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(useCommitment).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<CommitmentBlockResponse, Error>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CommitmentBlock', () => {
  it('CB7: panel title is "Commitment"', () => {
    mockQuery({ isLoading: true })
    render(<CommitmentBlock projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Commitment' })).toBeDefined()
  })

  it('CB4: while loading shows "Loading..." in text-sm text-[--text-muted]', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<CommitmentBlock projectId="proj-1" />)
    const loading = screen.getByText('Loading...')
    expect(loading).toBeDefined()
    expect(loading.className).toContain('text-sm')
    expect(loading.className).toContain('text-[--text-muted]')
  })

  it('CB1: renders markdown verbatim in <pre> with spec classes', () => {
    mockQuery({
      data: {
        markdown: '## Workflow commitment\n- foo\n- bar',
        sourceFile: '2026-05-06.md',
      },
    })
    render(<CommitmentBlock projectId="proj-1" />)

    const pre = screen.getByText(/## Workflow commitment/)
    expect(pre.tagName).toBe('PRE')
    expect(pre.className).toContain('whitespace-pre-wrap')
    expect(pre.className).toContain('font-mono')
    expect(pre.className).toContain('text-sm')
    expect(pre.className).toContain('text-[--text]')
    expect(pre.className).toContain('leading-relaxed')
    expect(pre.textContent).toBe('## Workflow commitment\n- foo\n- bar')
  })

  it('CB2: renders "Source: {filename}" line with spec classes', () => {
    mockQuery({
      data: {
        markdown: '## Workflow commitment\n- foo',
        sourceFile: '2026-05-06.md',
      },
    })
    render(<CommitmentBlock projectId="proj-1" />)

    const source = screen.getByText('Source: 2026-05-06.md')
    expect(source).toBeDefined()
    expect(source.className).toContain('font-mono')
    expect(source.className).toContain('text-xs')
    expect(source.className).toContain('text-[--text-subtle]')
  })

  it('CB3: when markdown is null, renders empty-state copy verbatim', () => {
    mockQuery({ data: { markdown: null, sourceFile: null } })
    render(<CommitmentBlock projectId="proj-1" />)

    expect(
      screen.getByText('No commitment block found. The latest session may not have emitted one yet.'),
    ).toBeDefined()
  })

  it('CB5: on schema_drift error, renders inline drift state with path visible', () => {
    mockQuery({
      error: new Error('schema_drift:markdown'),
      isLoading: false,
      data: undefined,
    })
    render(<CommitmentBlock projectId="proj-1" />)

    // Shows the drift path
    expect(screen.getByText(/markdown/)).toBeDefined()
    // Shows the "Schema drift" heading
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('CB6: on other errors, renders the panel in unreachable state', () => {
    mockQuery({
      error: new Error('Network error'),
      isLoading: false,
      data: undefined,
    })
    render(<CommitmentBlock projectId="proj-1" />)

    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })
})
