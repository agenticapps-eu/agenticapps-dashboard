import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CHECK_IDS,
  CHECK_STATUSES,
  type CheckId,
  type CheckResult,
  type CheckStatus,
} from '@agenticapps/dashboard-shared'

import {
  ReadinessIndicator,
  STATUS_PRESENTATION,
  CHECK_LABELS,
} from './ReadinessIndicator.js'

afterEach(cleanup)

/**
 * A wire-shaped result. `never` and `na` carry no observed time and no evidence
 * — the schema refuses them — so the fixture honours that rather than producing
 * a shape the daemon can never send.
 */
function result(
  id: CheckId,
  status: CheckStatus,
  over: Partial<CheckResult> = {},
): CheckResult {
  const timeless = status === 'never' || status === 'na'
  return {
    id,
    status,
    source: 'derived',
    at: timeless ? null : Date.UTC(2026, 6, 30, 9, 15),
    value: null,
    threshold: null,
    summary: status === 'na' ? 'this host cannot pin a version' : '',
    evidence: null,
    error: null,
    ...over,
  }
}

/** Six results, one per check, all `ok` unless overridden by id. */
function sixChecks(over: Partial<Record<CheckId, CheckStatus>> = {}): CheckResult[] {
  return CHECK_IDS.map((id) => result(id, over[id] ?? 'ok'))
}

function labels(): string[] {
  return screen
    .getAllByRole('figure')
    .map((cell) => cell.getAttribute('aria-label') ?? '')
}

describe('ReadinessIndicator', () => {
  it.each(['compact', 'full'] as const)(
    'renders all six checks in the fixed order — %s',
    (variant) => {
      render(
        <ReadinessIndicator
          checks={sixChecks()}
          repoName="dashboard"
          variant={variant}
        />,
      )

      const rendered = labels()
      expect(rendered).toHaveLength(CHECK_IDS.length)
      CHECK_IDS.forEach((id, index) => {
        expect(rendered[index]).toContain(CHECK_LABELS[id])
      })
    },
  )

  it('never omits a check to close a gap, and holds each position across repos', () => {
    render(
      <ReadinessIndicator checks={sixChecks()} repoName="alpha" variant="compact" />,
    )
    const allOk = labels().map((label) => label.split(' — ')[0])
    cleanup()

    render(
      <ReadinessIndicator
        checks={sixChecks({ spec: 'fail', 'pen-test': 'never', coverage: 'warn' })}
        repoName="beta"
        variant="compact"
      />,
    )
    const mixed = labels().map((label) => label.split(' — ')[0])

    expect(mixed).toEqual(allOk)
    expect(mixed).toHaveLength(CHECK_IDS.length)
  })

  it('gives every status its own shape, so colour is never the only channel', () => {
    const icons = new Set(CHECK_STATUSES.map((s) => STATUS_PRESENTATION[s].icon))
    expect(icons.size).toBe(CHECK_STATUSES.length)
  })

  it('gives every status its own words, so the disclosure never reads ambiguously', () => {
    const words = new Set(CHECK_STATUSES.map((s) => STATUS_PRESENTATION[s].word))
    expect(words.size).toBe(CHECK_STATUSES.length)
  })

  it.each([
    ['ok', 'bg-status-success/10', 'text-status-success'],
    ['warn', 'bg-status-warning/10', 'text-status-warning'],
    ['stale', 'bg-status-warning/10', 'text-status-warning'],
    ['fail', 'bg-status-error/10', 'text-status-error'],
    ['never', 'bg-text-tertiary/10', 'text-text-secondary'],
    ['na', 'bg-text-tertiary/10', 'text-text-secondary'],
  ] as const)('maps %s to its tokens', (status, bg, text) => {
    render(
      <ReadinessIndicator
        checks={[result('workflow', status)]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const cell = screen.getByRole('figure')
    expect(cell.className).toContain(bg)
    expect(cell.className).toContain(text)
  })

  it('shows a value in the full variant and withholds it in the compact one', () => {
    const checks = [result('coverage', 'ok', { value: 87.4, threshold: 80 })]

    render(
      <ReadinessIndicator checks={checks} repoName="dashboard" variant="full" />,
    )
    expect(screen.getByText('87.4')).toBeTruthy()
    cleanup()

    render(
      <ReadinessIndicator checks={checks} repoName="dashboard" variant="compact" />,
    )
    expect(screen.queryByText('87.4')).toBeNull()
  })

  it('discloses the check name, the status in words, the time and the provenance', () => {
    render(
      <ReadinessIndicator
        checks={[
          result('security-review', 'stale', {
            source: 'declared',
            at: Date.UTC(2026, 6, 30, 9, 15),
          }),
        ]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const cell = screen.getByRole('figure')
    const disclosure = cell.getAttribute('aria-label') ?? ''
    expect(disclosure).toContain(CHECK_LABELS['security-review'])
    expect(disclosure).toContain(STATUS_PRESENTATION.stale.word)
    expect(disclosure).toContain('2026-07-30 09:15 UTC')
    expect(disclosure).toContain('declared')
    // The same text is available to a pointer, not to a screen reader alone.
    expect(cell.getAttribute('title')).toBe(disclosure)
  })

  it('renders an em dash for a missing time rather than inventing one', () => {
    render(
      <ReadinessIndicator
        checks={[result('pen-test', 'never')]}
        repoName="dashboard"
        variant="compact"
      />,
    )

    const disclosure = screen.getByRole('figure').getAttribute('aria-label') ?? ''
    expect(disclosure).toContain('—')
    // Nothing resembling a rendered timestamp may stand in for the absent one.
    expect(disclosure).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(disclosure).not.toContain('UTC')
  })

  it('names the repo on the group so two rows are tellable apart', () => {
    render(
      <ReadinessIndicator checks={sixChecks()} repoName="dashboard" variant="compact" />,
    )
    expect(screen.getByRole('group').getAttribute('aria-label')).toContain('dashboard')
  })
})
