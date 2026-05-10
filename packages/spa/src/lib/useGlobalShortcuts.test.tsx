/**
 * useGlobalShortcuts.test.tsx — TDD tests for useGlobalShortcuts hook (Plan 06-03 Task 1).
 *
 * GS1: fire 'r' on '/'; invalidates ['registry']
 * GS2: fire 'R' (uppercase) on '/'; invalidates ['registry']
 * GS3: focus <input> then fire 'r'; NO invalidation (focus guard)
 * GS4: focus <textarea> then fire 'r'; NO invalidation
 * GS5: focus <div contentEditable> then fire 'r'; NO invalidation
 * GS6: fire 'r' with metaKey=true; NO invalidation (preserves Cmd-R)
 * GS7: fire 'r' with ctrlKey=true; NO invalidation
 * GS8: fire '?'; navigate({ to: '/help' })
 * GS9: fire 'r' on '/projects/xyz'; invalidates per-project query keys
 * GS10: fire '/' on '/'; focuses element with aria-label="Search projects"
 * GS11: fire '/' on '/projects/xyz' where no search input exists; no error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mutable pathname for tests
let mockPathname = '/'

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useRouterState: () => ({
      location: { pathname: mockPathname },
    }),
  }
})

import { useGlobalShortcuts } from './useGlobalShortcuts.js'

function TestHarness(): null {
  useGlobalShortcuts()
  return null
}

function renderHarness(qc?: QueryClient) {
  const client = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TestHarness />
    </QueryClientProvider>,
  )
}

function fireKey(key: string, options: KeyboardEventInit = {}): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

beforeEach(() => {
  mockPathname = '/'
  mockInvalidateQueries.mockClear()
  mockNavigate.mockClear()
})

describe('useGlobalShortcuts', () => {
  it('GS1: fire "r" on "/"; invalidates ["registry"]', () => {
    mockPathname = '/'
    renderHarness()
    fireKey('r')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['registry'] })
  })

  it('GS2: fire "R" (uppercase) on "/"; invalidates ["registry"]', () => {
    mockPathname = '/'
    renderHarness()
    fireKey('R')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['registry'] })
  })

  it('GS3: focus <input> then fire "r"; NO invalidation (focus guard)', () => {
    mockPathname = '/'
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TestHarness />
        <input type="text" data-testid="input-field" />
      </QueryClientProvider>,
    )
    const input = container.querySelector('input')!
    input.focus()
    fireKey('r')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('GS4: focus <textarea> then fire "r"; NO invalidation', () => {
    mockPathname = '/'
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TestHarness />
        <textarea data-testid="textarea-field" />
      </QueryClientProvider>,
    )
    const textarea = container.querySelector('textarea')!
    textarea.focus()
    fireKey('r')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('GS5: focus <div contentEditable> then fire "r"; NO invalidation', () => {
    mockPathname = '/'
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TestHarness />
        <div contentEditable="true" data-testid="editable-div" />
      </QueryClientProvider>,
    )
    const div = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    div.focus()
    fireKey('r')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('GS6: fire "r" with metaKey=true; NO invalidation (preserves Cmd-R)', () => {
    mockPathname = '/'
    renderHarness()
    fireKey('r', { metaKey: true })
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('GS7: fire "r" with ctrlKey=true; NO invalidation', () => {
    mockPathname = '/'
    renderHarness()
    fireKey('r', { ctrlKey: true })
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('GS8: fire "?"; navigate({ to: "/help" })', () => {
    mockPathname = '/'
    renderHarness()
    fireKey('?')
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/help' })
  })

  it('GS9: fire "r" on "/projects/xyz"; invalidates per-project query keys', () => {
    mockPathname = '/projects/xyz'
    renderHarness()
    fireKey('r')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['discipline'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['phase-progress'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['security'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['agentlinter'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['observability'] })
  })

  it('GS10: fire "/" on "/"; focuses element with aria-label="Search projects"', () => {
    mockPathname = '/'
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TestHarness />
        <input type="search" aria-label="Search projects" />
      </QueryClientProvider>,
    )
    const searchInput = container.querySelector('[aria-label="Search projects"]') as HTMLInputElement
    const focusSpy = vi.spyOn(searchInput, 'focus')
    fireKey('/')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('GS11: fire "/" on "/projects/xyz" where no search input exists; no error', () => {
    mockPathname = '/projects/xyz'
    renderHarness()
    expect(() => {
      fireKey('/')
    }).not.toThrow()
  })
})
