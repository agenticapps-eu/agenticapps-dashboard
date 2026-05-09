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
})
