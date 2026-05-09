/**
 * SidebarSection.test.tsx — TDD tests for SidebarSection primitive (Plan 05.1-02 Task 1).
 *
 * SS1: renders header text with uppercase/text-xs/tracking-wider/text-text-tertiary classes
 * SS2: header is NOT a button or anchor (not clickable — UI-SPEC §5)
 * SS3: renders children below the header
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { SidebarSection } from './SidebarSection.js'

describe('SidebarSection', () => {
  it('SS1: renders the label with uppercase tracking-wider text-xs text-text-tertiary classes', () => {
    render(
      <SidebarSection label="WORKSPACE">
        <div>child</div>
      </SidebarSection>,
    )
    // The label text is inside a div — find it via text content
    const header = screen.getByText('WORKSPACE')
    expect(header.className).toContain('uppercase')
    expect(header.className).toContain('tracking-wider')
    expect(header.className).toContain('text-xs')
    expect(header.className).toContain('text-text-tertiary')
  })

  it('SS2: section header is a <div>, NOT a <button> or <a>', () => {
    const { container } = render(
      <SidebarSection label="WORKSPACE">
        <div>child</div>
      </SidebarSection>,
    )
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('SS3: renders children below the header', () => {
    render(
      <SidebarSection label="ACCOUNT">
        <span data-testid="child-item">Settings</span>
      </SidebarSection>,
    )
    expect(screen.getByTestId('child-item')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
  })
})
