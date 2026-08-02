/**
 * Breadcrumb.test.tsx — TDD tests for Breadcrumb (Plan 05.1-02 Task 1).
 *
 * BC1: on '/' route, renders "All Projects"
 * BC2: on '/projects/:projectId', renders "All Projects · {projectId}"
 * BC3: on '/settings', renders "Settings"
 * BC4: on '/help', renders "Help"
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mockUseMatches = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useMatches: () => mockUseMatches(),
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  }
})

import { Breadcrumb } from './Breadcrumb.js'

describe('Breadcrumb', () => {
  it('BC1: on "/" route, renders "All Projects"', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: 'index', fullPath: '/', params: {} },
    ])
    render(<Breadcrumb />)
    expect(screen.getByText('All Projects')).toBeDefined()
  })

  it('BC2: on "/projects/:projectId" route, renders "All Projects" separator and projectId', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '_appshell', fullPath: '/', params: {} },
      { id: '/projects/$projectId', fullPath: '/projects/$projectId', params: { projectId: 'my-cool-project' } },
    ])
    render(<Breadcrumb />)
    expect(screen.getByText('All Projects')).toBeDefined()
    expect(screen.getByText('my-cool-project')).toBeDefined()
  })

  it('BC3: on "/settings" route, renders "Settings" as the breadcrumb', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '/settings', fullPath: '/settings', params: {} },
    ])
    render(<Breadcrumb />)
    expect(screen.getByText('Settings')).toBeDefined()
  })

  it('BC4: on "/help" route, renders "Help" as the breadcrumb', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '/help', fullPath: '/help', params: {} },
    ])
    render(<Breadcrumb />)
    expect(screen.getByText('Help')).toBeDefined()
  })

  it('BC5: on "/fleet", the crumb is the fleet, not "All Projects"', () => {
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '/fleet', fullPath: '/fleet', params: {} },
    ])
    render(<Breadcrumb />)
    expect(screen.getByText('Fleet readiness')).toBeDefined()
    expect(screen.queryByText('All Projects')).toBeNull()
  })

  it('BC6: on "/repos/:repoId", the crumb leads back to the fleet you came from', () => {
    // The detail is reachable only from /fleet, and until this existed the
    // chrome said "All Projects" there, highlighted no sidebar item, and
    // offered no way back — a dead end at the bottom of the triage loop.
    mockUseMatches.mockReturnValue([
      { id: '__root__', fullPath: '/', params: {} },
      { id: '/repos/$repoId', fullPath: '/repos/$repoId', params: { repoId: 'agenticapps-dashboard' } },
    ])
    render(<Breadcrumb />)

    const back = screen.getByText('Fleet readiness').closest('a')
    expect(back).not.toBeNull()
    expect(back?.getAttribute('href')).toBe('/fleet')
    expect(screen.getByText('agenticapps-dashboard')).toBeDefined()
    expect(screen.queryByText('All Projects')).toBeNull()
  })
})
