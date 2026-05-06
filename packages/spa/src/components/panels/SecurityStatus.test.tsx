/**
 * SecurityStatus.test.tsx — TDD tests for SecurityStatus panel.
 *
 * Tests SS1–SS5:
 * SS1: with cso present and dbSentinel null, renders /cso section with heading and content
 * SS2: when dbSentinel null, shows "Database Sentinel" heading + "not detected"
 * SS3: when both cso and dbSentinel populated, both sections render their content
 * SS4: when both null → empty-state copy "No /cso audit yet for this phase."
 * SS5: panel title is "Security Status"; loading + drift + unreachable work
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SecurityResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(),
  useObservations: vi.fn(),
  useDiscipline: vi.fn(),
  usePhaseProgress: vi.fn(),
  useSecurity: vi.fn(),
}))

import { useSecurity } from '../../lib/projectQueries.js'

import { SecurityStatus } from './SecurityStatus.js'

type MockQueryResult = Partial<UseQueryResult<SecurityResponse, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(useSecurity).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<SecurityResponse, Error>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SecurityStatus', () => {
  it('SS5: panel title is "Security Status"', () => {
    mockQuery({ isLoading: true })
    render(<SecurityStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Security Status' })).toBeDefined()
  })

  it('SS5: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<SecurityStatus projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('SS5: on schema_drift error, renders inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:cso'), isLoading: false, data: undefined })
    render(<SecurityStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('SS5: on other error, renders panel in unreachable state', () => {
    mockQuery({ error: new Error('Network error'), isLoading: false, data: undefined })
    render(<SecurityStatus projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('SS4: when both null, renders empty-state copy', () => {
    mockQuery({ data: { cso: null, dbSentinel: null } })
    render(<SecurityStatus projectId="proj-1" />)
    expect(screen.getByText('No /cso audit yet for this phase.')).toBeDefined()
  })

  it('SS1: with cso present and dbSentinel null, renders /cso section heading', () => {
    mockQuery({
      data: {
        cso: { fileName: '04-SECURITY.md', content: 'audit content here' },
        dbSentinel: null,
      },
    })
    render(<SecurityStatus projectId="proj-1" />)

    expect(screen.getByText(/\/cso audit \(04-SECURITY\.md\)/)).toBeDefined()
    expect(screen.getByText(/audit content here/)).toBeDefined()
  })

  it('SS2: when dbSentinel null, shows Database Sentinel heading and "not detected"', () => {
    mockQuery({
      data: {
        cso: { fileName: '04-SECURITY.md', content: 'audit' },
        dbSentinel: null,
      },
    })
    render(<SecurityStatus projectId="proj-1" />)

    expect(screen.getByText('Database Sentinel')).toBeDefined()
    expect(screen.getByText('not detected')).toBeDefined()
  })

  it('SS3: when both present, both sections render their content', () => {
    mockQuery({
      data: {
        cso: { fileName: '04-SECURITY.md', content: 'cso content' },
        dbSentinel: { fileName: '04-DB-SENTINEL.md', content: 'db sentinel content' },
      },
    })
    render(<SecurityStatus projectId="proj-1" />)

    expect(screen.getByText(/cso content/)).toBeDefined()
    expect(screen.getByText(/db sentinel content/)).toBeDefined()
  })

  it('SS1: cso content is in a <pre> clamped to max-h-32', () => {
    mockQuery({
      data: {
        cso: { fileName: '04-SECURITY.md', content: 'long content' },
        dbSentinel: null,
      },
    })
    render(<SecurityStatus projectId="proj-1" />)

    const pres = document.querySelectorAll('pre')
    const clamped = Array.from(pres).find((p) => p.className.includes('max-h-32'))
    expect(clamped).toBeDefined()
  })
})
