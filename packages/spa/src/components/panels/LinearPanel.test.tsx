/**
 * LinearPanel.test.tsx — TDD tests for LinearPanel (Phase 8, LINEAR-01/02/03).
 *
 * Tests LP1–LP13:
 * LP1:  loading state → renders Loading...
 * LP2:  schema_drift error → renders InlineDrift with path visible
 * LP3:  non-drift error → renders unreachable PanelContainer
 * LP4:  empty issues array (not-configured) → renders static "LINEAR_API_KEY" configure copy
 * LP5:  configure copy is a JSX literal, not sourced from query.data (T-05-05-Static-Copy-Trust)
 * LP6:  happy path → up to 3 issue rows each with identifier, title, stateName
 * LP7:  happy path → each issue links out to issue.url (target=_blank + rel=noopener)
 * LP8:  happy path → identifier is rendered (e.g. "ACME-123")
 * LP9:  happy path → assigneeName rendered; null assignee shows "Unassigned"
 * LP10: stale=true → PanelContainer renders Stale pill
 * LP11: stale=true → verbatim "Linear API unreachable — using cached data from" banner
 * LP12: configure empty state renders with defaultCollapsed (D-6.1-02)
 * LP13: LINEAR-02 clause (b) — IntegrationsHealth.tsx must NOT import useLinearIssues
 *        (static Linear surface stays API-free; verified by asserting the import is absent)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LinearIssuesResponse } from '@agenticapps/dashboard-shared'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../../lib/projectQueries.js', () => ({
  useLinearIssues: vi.fn(),
}))

import { useLinearIssues } from '../../lib/projectQueries.js'
import { LinearPanel } from './LinearPanel.js'

type LinearMock = Partial<UseQueryResult<LinearIssuesResponse, Error>>

function mockLinear(overrides: LinearMock = {}) {
  vi.mocked(useLinearIssues).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<LinearIssuesResponse, Error>)
}

const ISSUE_ONE: LinearIssuesResponse = {
  issues: [
    {
      identifier: 'ACME-123',
      title: 'Fix login redirect',
      url: 'https://linear.app/acme/issue/ACME-123',
      stateName: 'In Progress',
      stateType: 'started',
      assigneeName: 'Donald',
      stale: false,
    },
  ],
  stale: false,
}

const THREE_ISSUES: LinearIssuesResponse = {
  issues: [
    {
      identifier: 'ACME-1',
      title: 'Issue One',
      url: 'https://linear.app/acme/issue/ACME-1',
      stateName: 'Todo',
      stateType: 'unstarted',
      assigneeName: 'Alice',
      stale: false,
    },
    {
      identifier: 'ACME-2',
      title: 'Issue Two',
      url: 'https://linear.app/acme/issue/ACME-2',
      stateName: 'In Progress',
      stateType: 'started',
      assigneeName: null,
      stale: false,
    },
    {
      identifier: 'ACME-3',
      title: 'Issue Three',
      url: 'https://linear.app/acme/issue/ACME-3',
      stateName: 'Done',
      stateType: 'completed',
      assigneeName: 'Bob',
      stale: false,
    },
  ],
  stale: false,
}

const EMPTY: LinearIssuesResponse = {
  issues: [],
  stale: false,
}

const STALE_DATA: LinearIssuesResponse = {
  issues: [
    {
      identifier: 'ACME-123',
      title: 'Fix login redirect',
      url: 'https://linear.app/acme/issue/ACME-123',
      stateName: 'In Progress',
      stateType: 'started',
      assigneeName: 'Donald',
      stale: false,
    },
  ],
  stale: true,
  staleFrom: '2026-06-11T09:00:00.000Z',
  staleReason: 'unreachable',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LinearPanel', () => {
  it('LP1: loading state → renders Loading...', () => {
    mockLinear({ isLoading: true })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('LP2: schema_drift error → renders InlineDrift with path from error message', () => {
    mockLinear({ error: new Error('schema_drift:/api/projects/proj-1/linear/issues') })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/linear\/issues/)).toBeDefined()
  })

  it('LP3: non-drift error → renders unreachable PanelContainer', () => {
    mockLinear({ error: new Error('Network Error') })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('LP4: empty issues array → renders static "LINEAR_API_KEY" configure copy', () => {
    mockLinear({ data: EMPTY })
    const { container } = render(<LinearPanel projectId="proj-1" />)
    // Must expand the collapsed panel to check body
    fireEvent.click(screen.getByRole('button'))
    expect(container.textContent).toContain('LINEAR_API_KEY')
  })

  it('LP5: configure copy is static JSX, not sourced from query.data (T-05-05-Static-Copy-Trust)', () => {
    mockLinear({ data: EMPTY })
    const { container } = render(<LinearPanel projectId="proj-1" />)
    fireEvent.click(screen.getByRole('button'))
    // The literal must appear verbatim — "Set LINEAR_API_KEY to enable the Linear panel."
    expect(container.textContent).toContain('Set')
    expect(container.textContent).toContain('LINEAR_API_KEY')
    expect(container.textContent).toContain('enable the Linear panel')
  })

  it('LP6: happy path → issue rows with identifier, title, stateName', () => {
    mockLinear({ data: ISSUE_ONE })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('ACME-123')).toBeDefined()
    expect(screen.getByText('Fix login redirect')).toBeDefined()
    expect(screen.getByText('In Progress')).toBeDefined()
  })

  it('LP7: happy path → each issue links to issue.url with target=_blank and rel including noopener', () => {
    mockLinear({ data: ISSUE_ONE })
    const { container } = render(<LinearPanel projectId="proj-1" />)
    const link = container.querySelector('a[href="https://linear.app/acme/issue/ACME-123"]')
    expect(link).toBeDefined()
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('LP8: happy path → identifier rendered as text', () => {
    mockLinear({ data: ISSUE_ONE })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('ACME-123')).toBeDefined()
  })

  it('LP9a: happy path → assigneeName rendered when present', () => {
    mockLinear({ data: ISSUE_ONE })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('Donald')).toBeDefined()
  })

  it('LP9b: happy path → null assignee shows "Unassigned"', () => {
    mockLinear({ data: THREE_ISSUES })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('Unassigned')).toBeDefined()
  })

  it('LP10: stale=true → PanelContainer renders "Stale" pill', () => {
    mockLinear({ data: STALE_DATA })
    render(<LinearPanel projectId="proj-1" />)
    expect(screen.getByText('Stale')).toBeDefined()
  })

  it('LP11: stale=true + staleFrom → verbatim stale banner', () => {
    mockLinear({ data: STALE_DATA })
    const { container } = render(<LinearPanel projectId="proj-1" />)
    expect(container.textContent).toContain('Linear API unreachable — using cached data from')
    expect(container.textContent).toContain(STALE_DATA.staleFrom!)
  })

  it('LP12: configure empty state has defaultCollapsed (panel starts collapsed, click to expand)', () => {
    mockLinear({ data: EMPTY })
    render(<LinearPanel projectId="proj-1" />)
    // D-6.1-02: empty state panel is collapsed by default — header is a button
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    // The configure copy should NOT be visible initially
    expect(screen.queryByText('enable the Linear panel')).toBeNull()
    // After click, it expands
    fireEvent.click(button)
    expect(screen.getByText(/enable the Linear panel/)).toBeDefined()
  })

  it('LP13: LINEAR-02 clause (b) — IntegrationsHealth.tsx has no useLinearIssues import or /linear/issues reference', () => {
    // Read the actual source file and assert the API-free invariant
    const filePath = resolve(
      __dirname,
      './IntegrationsHealth.tsx',
    )
    const source = readFileSync(filePath, 'utf8')
    expect(source).not.toContain('useLinearIssues')
    expect(source).not.toContain('linear/issues')
  })

  // CR-01 defense-in-depth: schema already rejects non-http(s), but the render
  // guard is a second layer — verify it via a directly-constructed data object
  // that bypasses schema validation (as if schema parsing were somehow skipped).
  it('CR-01: render guard — non-http(s) url renders as plain text, not a live link', () => {
    // Bypass schema by casting — simulates defense-in-depth scenario
    const dataWithBadUrl: LinearIssuesResponse = {
      issues: [
        {
          identifier: 'BAD-001',
          title: 'Bad link issue',
          url: 'javascript:alert(1)' as unknown as `https://${string}`,
          stateName: 'In Progress',
          stateType: 'started',
          assigneeName: null,
          stale: false,
        },
      ],
      stale: false,
    }
    mockLinear({ data: dataWithBadUrl })
    const { container } = render(<LinearPanel projectId="proj-1" />)
    // Must NOT render as a live anchor with the malicious href
    const dangerousLink = container.querySelector('a[href="javascript:alert(1)"]')
    expect(dangerousLink).toBeNull()
    // The identifier should still appear as text
    expect(screen.getByText('BAD-001')).toBeDefined()
  })
})
