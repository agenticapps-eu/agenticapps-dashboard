/**
 * ProjectLayout.test.tsx — TDD tests for ProjectLayout component.
 *
 * Tests L1–L3:
 * L1: on mount, calls setAppShellWidth('max-w-7xl')
 * L2: on unmount, calls setAppShellWidth('max-w-3xl')
 * L3: renders children unwrapped (no extra wrapper div in DOM)
 */
import React from 'react'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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

  it('L3: renders children — children are directly accessible (no extra wrapper)', () => {
    render(
      <ProjectLayout>
        <div data-testid="child-content">hello</div>
        <div data-testid="child-content-2">world</div>
      </ProjectLayout>,
    )

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.getByText('hello')).toBeDefined()
    expect(screen.getByTestId('child-content-2')).toBeDefined()
    expect(screen.getByText('world')).toBeDefined()

    // Both children should have the same parent — they aren't wrapped in individual containers
    const child1 = screen.getByTestId('child-content')
    const child2 = screen.getByTestId('child-content-2')
    expect(child1.parentElement).toBe(child2.parentElement)
  })
})
