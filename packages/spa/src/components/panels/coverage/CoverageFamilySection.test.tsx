/**
 * CoverageFamilySection.test.tsx — Tests for sticky family header + rows + GitNexus install hint.
 *
 * CODEX HIGH-6 Option A: install hint inside each family header, not page-level banner.
 * CODEX MED: worst-state-wins per row (missing > stale > fresh > not-applicable).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { CoverageRow as CoverageRowData } from '@agenticapps/dashboard-shared'
import { CoverageFamilySection } from './CoverageFamilySection.js'

function makeRow(
  repo: string,
  states: {
    claudeMd?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    gitNexus?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    wiki?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    workflow?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  } = {},
): CoverageRowData {
  return {
    family: 'agenticapps',
    repo,
    claudeMd: { kind: 'basic', state: states.claudeMd ?? 'fresh' },
    gitNexus: { kind: 'basic', state: states.gitNexus ?? 'fresh' },
    wiki: { kind: 'basic', state: states.wiki ?? 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: states.workflow ?? 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount: 0,
    overrides: [],
  }
}

beforeEach(() => {
  // Clear localStorage between tests
  localStorage.clear()
})

describe('CoverageFamilySection', () => {
  it('renders sticky family header with family name and aggregate counts', () => {
    const rows = [
      makeRow('repo-a', { claudeMd: 'fresh' }),
      makeRow('repo-b', { gitNexus: 'stale' }),
    ]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={true} />,
    )
    expect(screen.getByText(/agenticapps/i)).toBeTruthy()
    // Should show counts
    expect(screen.getByText(/✓/)).toBeTruthy()
  })

  it('aggregate counts reflect FILTERED rows using worst-state-wins per row', () => {
    // repo-a: worst = missing (one column missing)
    // repo-b: worst = stale (one column stale, rest fresh)
    // repo-c: worst = fresh (all fresh)
    const rows = [
      makeRow('repo-a', { claudeMd: 'missing', gitNexus: 'fresh', wiki: 'fresh', workflow: 'fresh' }),
      makeRow('repo-b', { claudeMd: 'fresh', gitNexus: 'stale', wiki: 'fresh', workflow: 'fresh' }),
      makeRow('repo-c', { claudeMd: 'fresh', gitNexus: 'fresh', wiki: 'fresh', workflow: 'fresh' }),
    ]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={true} />,
    )
    // ✕ 1 (missing), ⚠ 1 (stale), ✓ 1 (fresh)
    expect(screen.getByText(/✕\s*1/)).toBeTruthy()
    expect(screen.getByText(/⚠\s*1/)).toBeTruthy()
    expect(screen.getByText(/✓\s*1/)).toBeTruthy()
  })

  it('aggregate count semantics: each row counts ONCE in the highest-priority bucket only (CODEX MED)', () => {
    // repo-a has BOTH missing AND stale columns — must count only ONCE in missing bucket
    const rows = [
      makeRow('repo-a', { claudeMd: 'missing', gitNexus: 'stale', wiki: 'fresh', workflow: 'fresh' }),
    ]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={true} />,
    )
    // Must show ✕ 1 (not ✕ 1 ⚠ 1 — double counting is wrong)
    expect(screen.getByText(/✕\s*1/)).toBeTruthy()
    // ⚠ count must be 0 (repo-a already counted in missing)
    expect(screen.getByText(/⚠\s*0/)).toBeTruthy()
  })

  it('collapse toggle button hides the table body when clicked', () => {
    const rows = [makeRow('repo-a')]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={true} />,
    )
    // Rows visible initially
    expect(screen.getByText('repo-a')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: /agenticapps/i })
    fireEvent.click(toggle)
    // Rows hidden after collapse
    expect(screen.queryByText('repo-a')).toBeNull()
  })

  it("localStorage 'coverage:section-collapsed:<family>' key is written on collapse/expand toggle", () => {
    const rows = [makeRow('repo-a')]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={true} />,
    )
    const toggle = screen.getByRole('button', { name: /agenticapps/i })
    fireEvent.click(toggle)
    expect(localStorage.getItem('coverage:section-collapsed:agenticapps')).toBe('true')
    fireEvent.click(toggle)
    expect(localStorage.getItem('coverage:section-collapsed:agenticapps')).toBe('false')
  })

  it("collapsed state is restored from localStorage 'coverage:section-collapsed:<family>' on mount", () => {
    localStorage.setItem('coverage:section-collapsed:factiv', 'true')
    const rows = [makeRow('repo-x')]
    render(
      <CoverageFamilySection family="factiv" rows={rows} gitNexusInstalled={true} />,
    )
    // repo-x should NOT be visible (section starts collapsed)
    expect(screen.queryByText('repo-x')).toBeNull()
  })

  it('renders GitNexus install hint inside family header when gitNexusInstalled=false (CODEX HIGH-6 Option A)', () => {
    const rows = [makeRow('repo-a')]
    render(
      <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstalled={false} />,
    )
    expect(screen.getByText(/GitNexus is not installed/i)).toBeTruthy()
  })
})
