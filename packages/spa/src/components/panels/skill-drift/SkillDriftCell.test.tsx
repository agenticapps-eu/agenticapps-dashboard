/**
 * SkillDriftCell.test.tsx — TDD tests for the per-(skill, project) matrix cell.
 *
 * Plan 11-05 Task 2 Step A.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SkillDriftCell } from './SkillDriftCell.js'

afterEach(() => cleanup())

describe('SkillDriftCell', () => {
  it('SC1: present + version + lastModifiedIso → renders ✓ + version text', () => {
    render(
      <SkillDriftCell
        cell={{
          present: true,
          version: '1.2.3',
          lastModifiedIso: '2026-05-16T00:00:00.000Z',
        }}
        skillId="agenticapps-workflow"
        projectName="agenticapps-dashboard"
      />,
    )
    expect(screen.getByText(/1\.2\.3/)).toBeDefined()
    expect(screen.getByText(/✓/)).toBeDefined()
  })

  it('SC2: absent → renders dim ✕ with text-text-tertiary treatment', () => {
    const { container } = render(
      <SkillDriftCell
        cell={{ present: false, version: null, lastModifiedIso: null }}
        skillId="some-skill"
        projectName="some-project"
      />,
    )
    // ✕ is rendered
    expect(container.textContent).toContain('✕')
    // Dim tertiary text token
    expect(container.querySelector('[class*="text-text-tertiary"]')).not.toBeNull()
  })

  it('SC3: present + version=null → renders ✓ + "version unknown" subtle text', () => {
    render(
      <SkillDriftCell
        cell={{
          present: true,
          version: null,
          lastModifiedIso: '2026-05-16T00:00:00.000Z',
        }}
        skillId="agenticapps-workflow"
        projectName="agenticapps-dashboard"
      />,
    )
    expect(screen.getByText(/version unknown/i)).toBeDefined()
    // ✓ still rendered to indicate presence
    expect(screen.getByText(/✓/)).toBeDefined()
  })

  it('SC4: aria-label is correct for present-with-version state', () => {
    render(
      <SkillDriftCell
        cell={{
          present: true,
          version: '1.2.3',
          lastModifiedIso: '2026-05-16T00:00:00.000Z',
        }}
        skillId="agenticapps-workflow"
        projectName="agenticapps-dashboard"
      />,
    )
    const labelled = screen.getByLabelText(
      /agenticapps-workflow present in agenticapps-dashboard, version 1\.2\.3/i,
    )
    expect(labelled).toBeDefined()
  })

  it('SC4b: aria-label is correct for present-with-version-unknown', () => {
    render(
      <SkillDriftCell
        cell={{
          present: true,
          version: null,
          lastModifiedIso: null,
        }}
        skillId="agenticapps-workflow"
        projectName="agenticapps-dashboard"
      />,
    )
    const labelled = screen.getByLabelText(
      /agenticapps-workflow present in agenticapps-dashboard, version unknown/i,
    )
    expect(labelled).toBeDefined()
  })

  it('SC4c: aria-label is correct for absent', () => {
    render(
      <SkillDriftCell
        cell={{ present: false, version: null, lastModifiedIso: null }}
        skillId="agenticapps-workflow"
        projectName="agenticapps-dashboard"
      />,
    )
    const labelled = screen.getByLabelText(
      /agenticapps-workflow absent in agenticapps-dashboard/i,
    )
    expect(labelled).toBeDefined()
  })
})
