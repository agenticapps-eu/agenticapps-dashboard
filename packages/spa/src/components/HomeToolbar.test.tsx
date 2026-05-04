import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { HomeToolbar } from './HomeToolbar.js'
import type { HomeToolbarProps } from './HomeToolbar.js'

// Mock registry lib (plan 06 dependency)
vi.mock('../lib/registry.js', () => ({
  computeOverflowChips: vi.fn((items: { tags: string[] }[]) => {
    const fixed = new Set(['all', 'active', 'client', 'internal'])
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const tag of item.tags) {
        if (!fixed.has(tag)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
      }
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, count]) => ({ tag, count }))
  }),
}))

const defaultProps: HomeToolbarProps = {
  items: [],
  selectedChips: new Set(['all']),
  onChipsChange: vi.fn(),
  searchText: '',
  onSearchChange: vi.fn(),
  sortKey: 'recommended',
  onSortChange: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomeToolbar', () => {
  it('renders all 4 fixed chips with correct labels', () => {
    render(<HomeToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /client/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /internal/ })).toBeInTheDocument()
  })

  it('renders overflow chips with (N) count suffix when items have non-fixed tags', () => {
    const items = [
      {
        id: '1',
        name: 'Proj 1',
        root: '/proj1',
        client: null,
        addedAt: new Date().toISOString(),
        tags: ['wip'],
        status: { reachable: true, currentPhase: null, lastCommitAt: null },
      },
      {
        id: '2',
        name: 'Proj 2',
        root: '/proj2',
        client: null,
        addedAt: new Date().toISOString(),
        tags: ['wip'],
        status: { reachable: true, currentPhase: null, lastCommitAt: null },
      },
    ]
    render(<HomeToolbar {...defaultProps} items={items} />)
    expect(screen.getByText(/wip/)).toBeInTheDocument()
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
  })

  it("clicking 'active' from default state emits Set(['active']) and removes 'all'", async () => {
    const onChipsChange = vi.fn()
    render(
      <HomeToolbar
        {...defaultProps}
        selectedChips={new Set(['all'])}
        onChipsChange={onChipsChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'active' }))
    expect(onChipsChange).toHaveBeenCalledWith(new Set(['active']))
  })

  it("clicking 'all' when {'active','client'} are selected emits Set(['all'])", async () => {
    const onChipsChange = vi.fn()
    render(
      <HomeToolbar
        {...defaultProps}
        selectedChips={new Set(['active', 'client'])}
        onChipsChange={onChipsChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'all' }))
    expect(onChipsChange).toHaveBeenCalledWith(new Set(['all']))
  })

  it("clicking 'active' twice: first emits Set(['active']), second emits Set()", async () => {
    const onChipsChange = vi.fn()
    const { rerender } = render(
      <HomeToolbar
        {...defaultProps}
        selectedChips={new Set(['all'])}
        onChipsChange={onChipsChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'active' }))
    expect(onChipsChange).toHaveBeenCalledWith(new Set(['active']))

    rerender(
      <HomeToolbar
        {...defaultProps}
        selectedChips={new Set(['active'])}
        onChipsChange={onChipsChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'active' }))
    expect(onChipsChange).toHaveBeenCalledWith(new Set())
  })

  it('typing in search box calls onSearchChange with each value', async () => {
    const onSearchChange = vi.fn()
    render(<HomeToolbar {...defaultProps} onSearchChange={onSearchChange} />)
    const user = userEvent.setup()
    const input = screen.getByRole('searchbox', { name: 'Search projects' })
    await user.type(input, 'abc')
    expect(onSearchChange).toHaveBeenCalledTimes(3)
  })

  it('pressing Esc in search calls onSearchChange with empty string', () => {
    const onSearchChange = vi.fn()
    render(<HomeToolbar {...defaultProps} searchText="hello" onSearchChange={onSearchChange} />)
    const input = screen.getByRole('searchbox', { name: 'Search projects' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('changing sort select calls onSortChange with new key', async () => {
    const onSortChange = vi.fn()
    render(<HomeToolbar {...defaultProps} onSortChange={onSortChange} />)
    const user = userEvent.setup()
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'lastCommit')
    expect(onSortChange).toHaveBeenCalledWith('lastCommit')
  })

  it('selected chip has bg-[--accent] class; unselected has bg-[--surface-elevated]', () => {
    render(
      <HomeToolbar
        {...defaultProps}
        selectedChips={new Set(['all'])}
      />,
    )
    const allChip = screen.getByRole('button', { name: 'all' })
    const activeChip = screen.getByRole('button', { name: 'active' })
    expect(allChip.className).toContain('bg-[--accent]')
    expect(activeChip.className).toContain('bg-[--surface-elevated]')
  })

  it('focus ring class present on chip buttons', () => {
    render(<HomeToolbar {...defaultProps} />)
    const allChip = screen.getByRole('button', { name: 'all' })
    expect(allChip.className).toContain('focus-visible:ring-')
  })

  it('search input has type="search" and aria-label="Search projects"', () => {
    render(<HomeToolbar {...defaultProps} />)
    const input = screen.getByRole('searchbox', { name: 'Search projects' })
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('aria-label', 'Search projects')
  })

  it('sort select has visually-hidden label associated via htmlFor', () => {
    render(<HomeToolbar {...defaultProps} />)
    // The label should be rendered with sr-only class
    const label = document.querySelector('label[for="sort-select"]')
    expect(label).not.toBeNull()
    expect(label?.className).toContain('sr-only')
  })
})
