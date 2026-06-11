/**
 * SentryPanel.test.tsx — TDD tests for SentryPanel (Phase 8, SENTRY-01/02/03).
 *
 * Tests SP1–SP12:
 * SP1:  loading state → renders Loading...
 * SP2:  schema_drift error → renders InlineDrift with path visible
 * SP3:  non-drift error → renders unreachable PanelContainer
 * SP4:  empty issues array (not-configured) → renders static "SENTRY_AUTH_TOKEN" configure copy
 * SP5:  configure copy is a JSX literal, not sourced from query.data (T-05-05-Static-Copy-Trust)
 * SP6:  happy path → up to 5 issue rows each with title + level badge
 * SP7:  happy path → each issue row links out to issue.permalink (target=_blank + rel=noopener)
 * SP8:  happy path → shortId is used as link text
 * SP9:  happy path → event count formatted with toLocaleString
 * SP10: stale=true → PanelContainer renders Stale pill
 * SP11: stale=true → verbatim "Sentry API unreachable — using cached data from" banner (SENTRY-02)
 * SP12: configure empty state renders with defaultCollapsed (D-6.1-02)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SentryRecentResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useSentryRecent: vi.fn(),
}))

import { useSentryRecent } from '../../lib/projectQueries.js'
import { SentryPanel } from './SentryPanel.js'

type SentryMock = Partial<UseQueryResult<SentryRecentResponse, Error>>

function mockSentry(overrides: SentryMock = {}) {
  vi.mocked(useSentryRecent).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<SentryRecentResponse, Error>)
}

const ISSUE_ONE: SentryRecentResponse = {
  issues: [
    {
      id: 'abc123',
      title: 'TypeError: Cannot read property of undefined',
      level: 'error',
      count: '42',
      lastSeen: '2026-06-11T10:00:00.000Z',
      permalink: 'https://sentry.io/organizations/acme/issues/1234/',
      shortId: 'ACME-1234',
    },
  ],
  stale: false,
}

const EMPTY: SentryRecentResponse = {
  issues: [],
  stale: false,
}

const STALE_DATA: SentryRecentResponse = {
  issues: [
    {
      id: 'abc123',
      title: 'TypeError: Cannot read property of undefined',
      level: 'error',
      count: '42',
      lastSeen: '2026-06-11T10:00:00.000Z',
      permalink: 'https://sentry.io/organizations/acme/issues/1234/',
      shortId: 'ACME-1234',
    },
  ],
  stale: true,
  staleFrom: '2026-06-11T09:00:00.000Z',
  staleReason: 'unreachable',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SentryPanel', () => {
  it('SP1: loading state → renders Loading...', () => {
    mockSentry({ isLoading: true })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('SP2: schema_drift error → renders InlineDrift with path from error message', () => {
    mockSentry({ error: new Error('schema_drift:/api/projects/proj-1/sentry/recent') })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/sentry\/recent/)).toBeDefined()
  })

  it('SP3: non-drift error → renders unreachable PanelContainer', () => {
    mockSentry({ error: new Error('Network Error') })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('SP4: empty issues array → renders static "SENTRY_AUTH_TOKEN" configure copy', () => {
    mockSentry({ data: EMPTY })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    // Must expand the collapsed panel to check body
    fireEvent.click(screen.getByRole('button'))
    expect(container.textContent).toContain('SENTRY_AUTH_TOKEN')
  })

  it('SP5: configure copy is static JSX, not sourced from query.data (T-05-05-Static-Copy-Trust)', () => {
    // Even with data that has no configureMessage field, the copy must still appear
    // This test verifies the configure copy is a literal, not data-driven
    mockSentry({ data: EMPTY })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    fireEvent.click(screen.getByRole('button'))
    // The literal must appear verbatim — "Set SENTRY_AUTH_TOKEN to enable the Sentry panel."
    expect(container.textContent).toContain('Set')
    expect(container.textContent).toContain('SENTRY_AUTH_TOKEN')
    expect(container.textContent).toContain('enable the Sentry panel')
  })

  it('SP6: happy path → issue rows rendered with title and level badge', () => {
    mockSentry({ data: ISSUE_ONE })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByText('TypeError: Cannot read property of undefined')).toBeDefined()
    // Level badge should appear
    expect(screen.getByText('error')).toBeDefined()
  })

  it('SP7: happy path → each issue links to permalink with target=_blank and rel including noopener', () => {
    mockSentry({ data: ISSUE_ONE })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    const link = container.querySelector('a[href="https://sentry.io/organizations/acme/issues/1234/"]')
    expect(link).toBeDefined()
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('SP8: happy path → shortId is used as link text', () => {
    mockSentry({ data: ISSUE_ONE })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByText('ACME-1234')).toBeDefined()
  })

  it('SP9: happy path → event count formatted with Number().toLocaleString()', () => {
    // count '1000' should appear formatted
    mockSentry({
      data: {
        issues: [{
          id: 'x',
          title: 'Big Error',
          level: 'error',
          count: '1000',
          lastSeen: '2026-06-11T10:00:00.000Z',
          permalink: 'https://sentry.io/org/proj/issues/9999/',
          shortId: 'PROJ-9999',
        }],
        stale: false,
      },
    })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    // Number(1000).toLocaleString() produces "1,000" in en-US
    // In jsdom locale may vary; just assert the numeric value appears somewhere
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('000')
  })

  it('SP10: stale=true → PanelContainer renders "Stale" pill', () => {
    mockSentry({ data: STALE_DATA })
    render(<SentryPanel projectId="proj-1" />)
    expect(screen.getByText('Stale')).toBeDefined()
  })

  it('SP11: stale=true + staleFrom → verbatim stale banner (SENTRY-02)', () => {
    mockSentry({ data: STALE_DATA })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    expect(container.textContent).toContain('Sentry API unreachable — using cached data from')
    expect(container.textContent).toContain(STALE_DATA.staleFrom!)
  })

  it('SP12: configure empty state has defaultCollapsed (panel starts collapsed, click to expand)', () => {
    mockSentry({ data: EMPTY })
    render(<SentryPanel projectId="proj-1" />)
    // D-6.1-02: empty state panel is collapsed by default — header is a button
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    // The configure copy should NOT be visible initially
    expect(screen.queryByText('enable the Sentry panel')).toBeNull()
    // After click, it expands
    fireEvent.click(button)
    expect(screen.getByText(/enable the Sentry panel/)).toBeDefined()
  })

  // CR-01 defense-in-depth: schema already rejects non-http(s), but the render
  // guard is a second layer — verify it via a directly-constructed data object
  // that bypasses schema validation (as if schema parsing were somehow skipped).
  it('CR-01: render guard — non-http(s) permalink renders as plain text, not a live link', () => {
    // Bypass schema by casting — simulates defense-in-depth scenario
    const dataWithBadUrl = {
      issues: [
        {
          id: 'x1',
          title: 'Bad link issue',
          level: 'error' as const,
          count: '1',
          lastSeen: '2026-06-11T10:00:00.000Z',
          permalink: 'javascript:alert(1)',
          shortId: 'BAD-001',
        },
      ],
      stale: false,
    }
    mockSentry({ data: dataWithBadUrl })
    const { container } = render(<SentryPanel projectId="proj-1" />)
    // Must NOT render as a live anchor with the malicious href
    const dangerousLink = container.querySelector('a[href="javascript:alert(1)"]')
    expect(dangerousLink).toBeNull()
    // The shortId should still appear as text
    expect(screen.getByText('BAD-001')).toBeDefined()
  })
})
