/**
 * ObservabilityHealth.test.tsx — TDD tests for ObservabilityHealth panel (HEALTH-03).
 *
 * Tests OH1–OH10:
 * OH1: loading state → renders Loading...
 * OH2: schema drift → renders InlineDrift
 * OH3: non-drift error → renders unreachable PanelContainer
 * OH4: all 3 tools detected with multiple signals → 3 rows with 'detected via' provenance
 * OH5: sentry detected, spotlight + sentry-cli not → sentry shows provenance, others 'not detected'
 * OH6: all 3 tools not-detected → empty-state verbatim copy
 * OH7: multi-signal provenance joined with ' + '
 * OH8: evidence string from daemon rendered (e.g. '@sentry/node@10.52.0')
 * OH9: provenance prefix 'detected via' rendered; signal list in separate span
 * OH10: tool labels 'Sentry', 'Spotlight', 'sentry-cli' present in happy path
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ObservabilityResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useObservability: vi.fn(),
}))

import { useObservability } from '../../lib/projectQueries.js'
import { ObservabilityHealth } from './ObservabilityHealth.js'

type ObsMock = Partial<UseQueryResult<ObservabilityResponse, Error>>

function mockObs(overrides: ObsMock = {}) {
  vi.mocked(useObservability).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<ObservabilityResponse, Error>)
}

const ALL_DETECTED: ObservabilityResponse = {
  sentry: {
    detected: true,
    signals: [
      { signal: 'sentry-sdk-dep', evidence: '@sentry/node@10.52.0' },
      { signal: 'sentryclirc', evidence: '.sentryclirc' },
    ],
  },
  spotlight: {
    detected: true,
    signals: [
      { signal: 'spotlight-dep', evidence: '@spotlightjs/core@2.0.0' },
    ],
  },
  sentryCli: {
    detected: true,
    signals: [
      { signal: 'sentry-cli-binary', evidence: '/usr/local/bin/sentry-cli' },
      { signal: 'sentry-cli-ci', evidence: '.github/workflows/release.yml' },
    ],
  },
}

const SENTRY_ONLY: ObservabilityResponse = {
  sentry: {
    detected: true,
    signals: [
      { signal: 'sentry-sdk-dep', evidence: '@sentry/node@10.52.0' },
    ],
  },
  spotlight: { detected: false, signals: [] },
  sentryCli: { detected: false, signals: [] },
}

const ALL_EMPTY: ObservabilityResponse = {
  sentry: { detected: false, signals: [] },
  spotlight: { detected: false, signals: [] },
  sentryCli: { detected: false, signals: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ObservabilityHealth', () => {
  it('OH1: loading state → renders Loading...', () => {
    mockObs({ isLoading: true })
    render(<ObservabilityHealth projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('OH2: schema drift → renders InlineDrift with path from error message', () => {
    mockObs({ error: new Error('schema_drift:/api/projects/proj-1/observability') })
    render(<ObservabilityHealth projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/observability/)).toBeDefined()
  })

  it('OH3: non-drift error → renders unreachable PanelContainer', () => {
    mockObs({ error: new Error('Network Error') })
    render(<ObservabilityHealth projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('OH4: all 3 tools detected → 3 rows each showing "detected via" provenance', () => {
    mockObs({ data: ALL_DETECTED })
    render(<ObservabilityHealth projectId="proj-1" />)
    // All 3 tools present
    expect(screen.getByText('Sentry')).toBeDefined()
    expect(screen.getByText('Spotlight')).toBeDefined()
    expect(screen.getByText('sentry-cli')).toBeDefined()
    // "detected via" prefix present for all 3 detected rows
    // Use exact:false since Testing Library normalizes trailing whitespace
    const detectedVia = screen.getAllByText('detected via', { exact: false })
    expect(detectedVia.length).toBe(3)
  })

  it('OH5: sentry detected, spotlight + sentry-cli not → sentry shows provenance, others show "not detected"', () => {
    mockObs({ data: SENTRY_ONLY })
    render(<ObservabilityHealth projectId="proj-1" />)
    // Sentry row has provenance prefix
    expect(screen.getAllByText('detected via', { exact: false }).length).toBe(1)
    // Spotlight and sentry-cli show "not detected"
    const notDetected = screen.getAllByText('not detected')
    expect(notDetected.length).toBe(2)
  })

  it('OH6: all 3 tools not-detected → empty-state verbatim copy', () => {
    mockObs({ data: ALL_EMPTY })
    render(<ObservabilityHealth projectId="proj-1" />)
    // D-6.1-02: empty-state panel collapses by default — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen.getByText('No observability tooling detected. (Configure to enable.)')
    ).toBeDefined()
  })

  it('OH7: multi-signal provenance joined with " + "', () => {
    mockObs({ data: ALL_DETECTED })
    render(<ObservabilityHealth projectId="proj-1" />)
    // sentry-cli has 2 signals joined with ' + '
    expect(screen.getByText('/usr/local/bin/sentry-cli + .github/workflows/release.yml')).toBeDefined()
  })

  it('OH8: evidence string from daemon rendered (e.g. "@sentry/node@10.52.0")', () => {
    mockObs({ data: SENTRY_ONLY })
    render(<ObservabilityHealth projectId="proj-1" />)
    expect(screen.getByText('@sentry/node@10.52.0')).toBeDefined()
  })

  it('OH9: "detected via" prefix rendered in its own span; evidence in separate span', () => {
    mockObs({ data: SENTRY_ONLY })
    const { container } = render(<ObservabilityHealth projectId="proj-1" />)
    // The prefix "detected via " must appear in a span element
    const spans = Array.from(container.querySelectorAll('span'))
    const prefixSpan = spans.find(el => el.textContent === 'detected via ')
    expect(prefixSpan).toBeDefined()
    // The evidence text is in its own sibling span
    const evidenceSpan = spans.find(el => el.textContent === '@sentry/node@10.52.0')
    expect(evidenceSpan).toBeDefined()
  })

  it('OH10: tool labels "Sentry", "Spotlight", "sentry-cli" all present', () => {
    mockObs({ data: ALL_DETECTED })
    render(<ObservabilityHealth projectId="proj-1" />)
    expect(screen.getByText('Sentry')).toBeDefined()
    expect(screen.getByText('Spotlight')).toBeDefined()
    expect(screen.getByText('sentry-cli')).toBeDefined()
  })
})
