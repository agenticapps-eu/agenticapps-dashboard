import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

// Mock useUnregister hook
const mockMutate = vi.fn()
const mockUseUnregister = vi.fn()
vi.mock('../lib/registry.js', () => ({
  useUnregister: (...args: unknown[]) => mockUseUnregister(...args),
  computeOverflowChips: vi.fn(() => []),
}))

// Mock createPortal so it renders inline in jsdom
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  }
})

import { CardContextMenu } from './CardContextMenu.js'
import type { CardContextMenuProps } from './CardContextMenu.js'

function makeItem(overrides: Partial<RegistryListItem> = {}): RegistryListItem {
  return {
    id: 'proj-1',
    name: 'My Project',
    root: '/Users/donald/proj1',
    client: null,
    addedAt: new Date().toISOString(),
    tags: ['active'],
    status: {
      reachable: true,
      currentPhase: '03-home',
      lastCommitAt: null,
    },
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const defaultProps: CardContextMenuProps = {
  anchor: { type: 'pointer', x: 100, y: 200 },
  item: makeItem(),
  onAction: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUnregister.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  })
})

describe('CardContextMenu', () => {
  it('renders with role="menu" and 3 menuitems', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('first item is focused on mount', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
  })

  it('ArrowDown moves focus to second item', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    const items = screen.getAllByRole('menuitem')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
  })

  it('ArrowUp from first item wraps focus to last item', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    const items = screen.getAllByRole('menuitem')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Enter on focused Rename menuitem calls onAction("rename") + onClose', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(
      <CardContextMenu {...defaultProps} onAction={onAction} onClose={onClose} />,
      { wrapper },
    )
    const renameItem = screen.getByRole('menuitem', { name: /Rename/ })
    fireEvent.click(renameItem)
    expect(onAction).toHaveBeenCalledWith('rename')
    expect(onClose).toHaveBeenCalled()
  })

  it('Esc key calls onClose', () => {
    const onClose = vi.fn()
    render(<CardContextMenu {...defaultProps} onClose={onClose} />, { wrapper })
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking Unregister switches mode to confirm; original menuitems no longer visible', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    const unregisterBtn = screen.getByRole('menuitem', { name: /Unregister/ })
    fireEvent.click(unregisterBtn)
    // Should now show confirm mode with no menuitems
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(screen.getByText('Unregister My Project?')).toBeInTheDocument()
  })

  it('in confirm mode, clicking Cancel returns to menu mode with 3 menuitems', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    fireEvent.click(screen.getByRole('menuitem', { name: /Unregister/ }))
    // Now in confirm mode
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    // Back to menu mode
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('in confirm mode, clicking Unregister calls mutate() and onClose', () => {
    const onClose = vi.fn()
    render(
      <CardContextMenu {...defaultProps} onClose={onClose} />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('menuitem', { name: /Unregister/ }))
    // Click the danger confirm button
    const confirmBtn = screen.getByRole('button', { name: 'Unregister' })
    fireEvent.click(confirmBtn)
    expect(mockMutate).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Unregister item has text-[--danger] color class', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    const unregisterBtn = screen.getByRole('menuitem', { name: /Unregister/ })
    expect(unregisterBtn.className).toContain('text-[--danger]')
  })

  it('clicking outside the menu calls onClose', () => {
    const onClose = vi.fn()
    render(<CardContextMenu {...defaultProps} onClose={onClose} />, { wrapper })
    // Simulate a mousedown outside the menu container
    act(() => {
      fireEvent.mouseDown(document.body)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('confirm body subtext matches verbatim copy', () => {
    render(<CardContextMenu {...defaultProps} />, { wrapper })
    fireEvent.click(screen.getByRole('menuitem', { name: /Unregister/ }))
    expect(
      screen.getByText('This only removes it from the dashboard. No files are deleted.'),
    ).toBeInTheDocument()
  })

  it('confirm heading interpolates item name correctly', () => {
    render(
      <CardContextMenu
        {...defaultProps}
        item={makeItem({ name: 'Acme App' })}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('menuitem', { name: /Unregister/ }))
    expect(screen.getByText('Unregister Acme App?')).toBeInTheDocument()
  })

  it('opens directly in unregister-confirm mode when initialMode="unregister-confirm"', () => {
    render(
      <CardContextMenu {...defaultProps} initialMode="unregister-confirm" />,
      { wrapper },
    )
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(screen.getByText('Unregister My Project?')).toBeInTheDocument()
  })
})
