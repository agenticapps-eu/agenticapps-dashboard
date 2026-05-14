/**
 * CoverageCell.test.tsx — Tests for 4-state icon+label+token rendering.
 *
 * CODEX HIGH-4: workflow column variant has 5 sub-states
 *   (behind/ahead/equal/version-unknown/skill-missing).
 * Phase 05.1 token lock: exact Tailwind class names from the design system.
 * UI-SPEC §4: state → bg/text token mapping.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CoverageColumnState } from '@agenticapps/dashboard-shared'
import { CoverageCell } from './CoverageCell.js'

function makeBasic(state: 'fresh' | 'stale' | 'missing' | 'not-applicable', label?: string): CoverageColumnState {
  return { kind: 'basic', state, label }
}

function makeWorkflow(
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable',
  detail: 'equal' | 'behind' | 'ahead' | 'version-unknown' | 'skill-missing',
  installedVersion?: string | null,
  headVersion?: string | null,
): CoverageColumnState {
  return {
    kind: 'workflow',
    state,
    installedVersion: installedVersion ?? null,
    headVersion: headVersion ?? null,
    detail,
  }
}

describe('CoverageCell', () => {
  it('fresh state: renders success icon with bg-status-success/10 token and text-status-success token', () => {
    render(
      <CoverageCell column="claudeMd" state={makeBasic('fresh')} repoName="my-repo" />,
    )
    const cell = screen.getByRole('figure')
    expect(cell.className).toContain('bg-status-success/10')
    expect(cell.className).toContain('text-status-success')
  })

  it('stale state: renders warning icon with bg-status-warning/10 token and text-status-warning token', () => {
    render(
      <CoverageCell column="gitNexus" state={makeBasic('stale')} repoName="my-repo" />,
    )
    const cell = screen.getByRole('figure')
    expect(cell.className).toContain('bg-status-warning/10')
    expect(cell.className).toContain('text-status-warning')
  })

  it('missing state: renders error icon with bg-status-error/10 token and text-status-error token', () => {
    render(
      <CoverageCell column="wiki" state={makeBasic('missing')} repoName="my-repo" />,
    )
    const cell = screen.getByRole('figure')
    expect(cell.className).toContain('bg-status-error/10')
    expect(cell.className).toContain('text-status-error')
  })

  it('not-applicable state: renders neutral icon with bg-text-tertiary/10 token and text-text-tertiary token', () => {
    render(
      <CoverageCell column="workflowVersion" state={makeBasic('not-applicable')} repoName="my-repo" />,
    )
    const cell = screen.getByRole('figure')
    expect(cell.className).toContain('bg-text-tertiary/10')
    expect(cell.className).toContain('text-text-tertiary')
  })

  it('optional label string is rendered as subtext below the state icon when provided', () => {
    render(
      <CoverageCell column="wiki" state={makeBasic('stale', 'stale 22d')} repoName="my-repo" />,
    )
    expect(screen.getByText('stale 22d')).toBeTruthy()
  })

  it("workflow column variant BEHIND: renders 'Installed 1.7.0 → head 1.8.0'", () => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={makeWorkflow('stale', 'behind', '1.7.0', '1.8.0')}
        repoName="agenticapps-dash"
      />,
    )
    expect(screen.getByText('Installed 1.7.0 → head 1.8.0')).toBeTruthy()
  })

  it("workflow column variant AHEAD: renders 'Installed 1.9.0 (ahead of head 1.8.0)'", () => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={makeWorkflow('fresh', 'ahead', '1.9.0', '1.8.0')}
        repoName="agenticapps-dash"
      />,
    )
    expect(screen.getByText('Installed 1.9.0 (ahead of head 1.8.0)')).toBeTruthy()
  })

  it("workflow column variant VERSION-UNKNOWN: renders 'Installed version unknown'", () => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={makeWorkflow('stale', 'version-unknown', null, null)}
        repoName="agenticapps-dash"
      />,
    )
    expect(screen.getByText('Installed version unknown')).toBeTruthy()
  })

  it("workflow column variant SKILL-MISSING: renders 'No skill installed'", () => {
    render(
      <CoverageCell
        column="workflowVersion"
        state={makeWorkflow('missing', 'skill-missing', null, null)}
        repoName="agenticapps-dash"
      />,
    )
    expect(screen.getByText('No skill installed')).toBeTruthy()
  })
})
