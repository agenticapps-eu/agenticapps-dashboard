import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CoverageCell } from './CoverageCell.js'

describe('CoverageCell', () => {
  it.each(['fresh', 'stale', 'missing'] as const)('renders current state %s', (state) => {
    render(
      <CoverageCell
        column="claudeMd"
        state={{ kind: 'basic', state }}
        repoName="dashboard"
      />,
    )
    expect(screen.getByRole('figure').getAttribute('aria-label')).toContain(state)
  })

  it.each([
    ['fresh', 'bg-status-success/10', 'text-status-success'],
    ['stale', 'bg-status-warning/10', 'text-status-warning'],
    ['missing', 'bg-status-error/10', 'text-status-error'],
  ] as const)('maps %s to the locked design tokens', (state, background, text) => {
    render(
      <CoverageCell
        column="claudeMd"
        state={{ kind: 'basic', state }}
        repoName="dashboard"
      />,
    )

    expect(screen.getByRole('figure').className).toContain(background)
    expect(screen.getByRole('figure').className).toContain(text)
  })

  it('renders workflow detail and drift', () => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={{
          kind: 'workflow',
          state: 'stale',
          installedVersion: '2.5.0',
          headVersion: '3.0.0',
          detail: 'behind',
        }}
        repoName="dashboard"
        drift={{ direction: 'down', daysSince: 2 }}
      />,
    )
    expect(screen.getByText(/Installed 2.5.0/)).toBeTruthy()
    expect(screen.getByLabelText(/regressed 2 days ago/i)).toBeTruthy()
  })

  it.each([
    ['equal', '3.0.0'],
    ['ahead', 'Installed 3.0.0 (ahead of head 2.5.0)'],
    ['version-unknown', 'Installed version unknown'],
    ['skill-missing', 'No skill installed'],
  ] as const)('renders workflow detail %s', (detail, expected) => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={{
          kind: 'workflow',
          state: detail === 'skill-missing' ? 'missing' : detail === 'version-unknown' ? 'stale' : 'fresh',
          installedVersion: detail === 'version-unknown' || detail === 'skill-missing' ? null : '3.0.0',
          headVersion: detail === 'ahead' ? '2.5.0' : '3.0.0',
          detail,
        }}
        repoName="dashboard"
      />,
    )

    expect(screen.getByText(expected)).toBeTruthy()
  })

  it.each([
    undefined,
    null,
    { direction: null, daysSince: null },
    { direction: 'up' as const, daysSince: null },
  ])('does not render a drift badge for incomplete drift %j', (drift) => {
    render(
      <CoverageCell
        column="claudeMd"
        state={{ kind: 'basic', state: 'fresh' }}
        repoName="dashboard"
        {...(drift !== undefined ? { drift } : {})}
      />,
    )

    expect(screen.queryByText(/▲|▼/)).toBeNull()
  })

  it('distinguishes scanner failure from a confirmed missing cell', () => {
    render(
      <CoverageCell
        column="claudeMd"
        state={{
          kind: 'basic',
          state: 'missing',
          degraded: true,
          degradedReason: 'permission denied',
        }}
        repoName="dashboard"
      />,
    )

    expect(screen.getByText('scan failed')).toBeTruthy()
    expect(screen.getByRole('figure').getAttribute('title')).toBe('permission denied')
  })
})
