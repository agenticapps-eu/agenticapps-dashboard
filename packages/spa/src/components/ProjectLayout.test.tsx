/**
 * ProjectLayout.test.tsx — TDD tests for ProjectLayout component.
 *
 * Tests L1–L3:
 * L1: on mount, calls setAppShellWidth('max-w-7xl')
 * L2: on unmount, calls setAppShellWidth('max-w-3xl')
 * L3: renders children unwrapped (no extra wrapper div in DOM)
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

import { setAppShellWidth, getSnapshot } from '../lib/appShellWidth.js'
import { ProjectLayout } from './ProjectLayout.js'

beforeEach(() => {
  setAppShellWidth('max-w-3xl')
})

afterEach(() => {
  cleanup()
})

describe('ProjectLayout', () => {
  it('L1: sets max-w-7xl in the store on mount via useEffect', () => {
    expect(getSnapshot()).toBe('max-w-3xl')

    render(
      <ProjectLayout>
        <span>content</span>
      </ProjectLayout>,
    )

    expect(getSnapshot()).toBe('max-w-7xl')
  })

  it('L2: resets store to max-w-3xl on unmount', () => {
    const { unmount } = render(
      <ProjectLayout>
        <span>content</span>
      </ProjectLayout>,
    )

    expect(getSnapshot()).toBe('max-w-7xl')

    unmount()
    expect(getSnapshot()).toBe('max-w-3xl')
  })

  it('L3: renders children without extra wrapper div', () => {
    render(
      <ProjectLayout>
        <div data-testid="child-content">hello</div>
      </ProjectLayout>,
    )

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.getByText('hello')).toBeDefined()
    // Children rendered directly — no wrapping element adds depth
    const child = screen.getByTestId('child-content')
    // The child's parent should be the document body or a React portal boundary,
    // not an extra wrapper div introduced by ProjectLayout
    expect(child.parentElement?.tagName).not.toBe('DIV')
  })
})
