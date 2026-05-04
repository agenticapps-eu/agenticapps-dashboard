import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'
import type { ProjectOverview } from '../lib/registry.js'

// Mock useNavigate from TanStack Router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock useProjectOverview hook from registry lib
const mockUseProjectOverview = vi.fn()
vi.mock('../lib/registry.js', () => ({
  useProjectOverview: (...args: unknown[]) => mockUseProjectOverview(...args),
  computeOverflowChips: vi.fn(() => []),
}))

// Mock touchLongPress
vi.mock('../lib/touchLongPress.js', () => ({
  useLongPress: (_cb: () => void) => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerCancel: vi.fn(),
  }),
}))

import { ProjectCard } from './ProjectCard.js'

function makeItem(overrides: Partial<RegistryListItem> = {}): RegistryListItem {
  return {
    id: 'proj-1',
    name: 'My Project',
    root: '/Users/donald/proj1',
    client: 'Acme Corp',
    addedAt: new Date().toISOString(),
    tags: ['active'],
    status: {
      reachable: true,
      currentPhase: '03-multi-project-home',
      lastCommitAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(), // 14m ago
    },
    ...overrides,
  }
}

function makeOverview(overrides: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    phaseStatus: 'In Progress',
    stage1: null,
    stage2: { ran: true, findings: { red: 0, yellow: 2, green: 5 } },
    dbAudit: null,
    tdd: null,
    verification: null,
    branch: 'feat/home',
    markers: { gitRepo: true, planning: true, claudeSkills: true },
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockClear()
})

describe('ProjectCard', () => {
  it('shows — placeholders and aria-busy while loading', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const card = screen.getByRole('button', { name: 'View My Project' })
    expect(card).toHaveAttribute('aria-busy', 'true')
    // Should show em-dash placeholder
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('shows finding glyphs and aria-label in ready state with stage2 data', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByLabelText('0 critical, 2 medium, 5 low')).toBeInTheDocument()
    expect(screen.getByText('🔴')).toBeInTheDocument()
    expect(screen.getByText('🟡')).toBeInTheDocument()
    expect(screen.getByText('🟢')).toBeInTheDocument()
  })

  it('shows AlertTriangle and "overview unavailable · retrying" with role="status" on 5xx error', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('HTTP 500'),
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('overview unavailable · retrying')
  })

  it('renders SchemaDriftState when error message starts with schema_drift:', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('schema_drift: field mismatch'),
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    // SchemaDriftState renders "Schema drift detected"
    expect(screen.getByText('Schema drift detected')).toBeInTheDocument()
  })

  it('renders opacity-60, unreachable badge, and "Unregister?" link when unreachable', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({ status: { reachable: false, currentPhase: null, lastCommitAt: null } })
    render(
      <ProjectCard item={item} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const card = screen.getByRole('button', { name: 'View My Project' })
    expect(card.className).toContain('opacity-60')
    expect(screen.getByText(/unreachable:/)).toBeInTheDocument()
    expect(screen.getByText('Unregister?')).toBeInTheDocument()
  })

  it('renders "no .planning/" text and install link when currentPhase is null', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview({ phaseStatus: 'Pending' }),
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({ status: { reachable: true, currentPhase: null, lastCommitAt: null } })
    render(
      <ProjectCard item={item} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByText('no .planning/')).toBeInTheDocument()
    expect(screen.getByText('install workflow skill →')).toBeInTheDocument()
  })

  it('card click calls navigate to /projects/<id>', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const card = screen.getByRole('button', { name: 'View My Project' })
    fireEvent.click(card)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/projects/$projectId',
      params: { projectId: 'proj-1' },
    })
  })

  it('right-click calls onContextMenu with { type: pointer, x, y } and prevents default navigation', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const onContextMenu = vi.fn()
    render(
      <ProjectCard item={makeItem()} onContextMenu={onContextMenu} />,
      { wrapper },
    )
    const card = screen.getByRole('button', { name: 'View My Project' })
    fireEvent.contextMenu(card, { clientX: 100, clientY: 200 })
    expect(onContextMenu).toHaveBeenCalledWith(
      { type: 'pointer', x: 100, y: 200 },
      expect.objectContaining({ id: 'proj-1' }),
    )
    // navigate should NOT be called on right-click
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('kebab button click stops propagation and calls onContextMenu (navigate NOT called)', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const onContextMenu = vi.fn()
    render(
      <ProjectCard item={makeItem()} onContextMenu={onContextMenu} />,
      { wrapper },
    )
    const kebab = screen.getByRole('button', { name: 'Project options for My Project' })
    fireEvent.click(kebab)
    expect(onContextMenu).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('kebab has correct aria-label and aria-haspopup="menu"', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const kebab = screen.getByRole('button', { name: 'Project options for My Project' })
    expect(kebab).toHaveAttribute('aria-label', 'Project options for My Project')
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('hover-expand section contains group-hover:max-h-[200px] and motion-safe: classes', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    // The expanded section should have group-hover max-height class and motion-safe transition
    const expandedSection = document.querySelector('.group-hover\\:max-h-\\[200px\\]')
    expect(expandedSection).not.toBeNull()
    expect(expandedSection?.className).toContain('motion-safe:')
  })

  it('D-43 anti-slop: card classNames do NOT include rotate, scale, animate-pulse, animate-bounce, or shimmer', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    render(
      <ProjectCard item={makeItem()} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const cardContent = document.body.innerHTML
    expect(cardContent).not.toMatch(/\brotate-\d/)
    expect(cardContent).not.toMatch(/\bscale-\d/)
    expect(cardContent).not.toContain('animate-pulse')
    expect(cardContent).not.toContain('animate-bounce')
    expect(cardContent).not.toContain('shimmer')
  })
})
