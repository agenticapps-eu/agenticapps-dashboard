import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RegistryListItem, ProjectOverview } from '@agenticapps/dashboard-shared'

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
  useLongPress: () => ({
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
      condition: 'migrated' as const,
      // A migrated project with work in flight is the representative default;
      // the empty case has its own test.
      openChanges: [
        { name: 'add-reader', completedTasks: 2, totalTasks: 5, hasTaskArtifact: true },
      ],
      capabilityCount: 12,
      lastCommitAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(), // 14m ago
    },
    ...overrides,
  }
}

function makeOverview(overrides: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    tdd: null,
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
  it('sets aria-busy while the overview loads, without blanking change data', () => {
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
    // The change line no longer has a loading state: open changes arrive with
    // the registry list, not the per-project overview fetch. Only the rows that
    // genuinely depend on the overview (TDD pairs, branch) wait on it, and
    // aria-busy still reports that wait.
    expect(screen.getByText(/1 open change/)).toBeInTheDocument()
  })

  /*
   * The review-finding glyph rows are gone with the GSD phase reader — their
   * only source was phase-artifact parsing, and this change's spec delta drops
   * the field rather than approximating it from OpenSpec's reviewer prose.
   */
  it('renders no review finding glyphs, whatever the overview reports', () => {
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
    expect(screen.queryByText('🔴')).not.toBeInTheDocument()
    expect(screen.queryByText('🟡')).not.toBeInTheDocument()
    expect(screen.queryByText('🟢')).not.toBeInTheDocument()
    expect(screen.queryByText(/Stage 2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/DB-AUDIT/)).not.toBeInTheDocument()
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
    const item = makeItem({ status: { reachable: false, condition: 'unreachable' as const, openChanges: [], capabilityCount: 0, lastCommitAt: null } })
    render(
      <ProjectCard item={item} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    const card = screen.getByRole('button', { name: 'View My Project' })
    expect(card.className).toContain('opacity-60')
    expect(screen.getByText(/unreachable:/)).toBeInTheDocument()
    expect(screen.getByText('Unregister?')).toBeInTheDocument()
  })

  it('renders "no workflow" text and install link for the no-workflow condition', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({ status: { reachable: true, condition: 'no-workflow' as const, openChanges: [], capabilityCount: 0, lastCommitAt: null } })
    render(
      <ProjectCard item={item} onContextMenu={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByText('no workflow')).toBeInTheDocument()
    expect(screen.getByText('install workflow skill →')).toBeInTheDocument()
  })

  // The contradiction a reviewer caught: a GSD-only repo has the workflow
  // installed, so an install hint is wrong. It needs a migration hint.
  it('renders a migration hint, not an install hint, for needs-migration', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({ status: { reachable: true, condition: 'needs-migration' as const, openChanges: [], capabilityCount: 0, lastCommitAt: null } })
    render(<ProjectCard item={item} onContextMenu={vi.fn()} />, { wrapper })
    expect(screen.getByText('workflow installed, not yet on OpenSpec')).toBeInTheDocument()
    expect(screen.getByText('migrate →')).toBeInTheDocument()
    expect(screen.queryByText('install workflow skill →')).not.toBeInTheDocument()
  })

  it('renders open changes with task ratios, and no task list where absent', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({
      status: {
        reachable: true,
        condition: 'migrated' as const,
        openChanges: [
          { name: 'add-reader', completedTasks: 23, totalTasks: 69, hasTaskArtifact: true },
          { name: 'no-tasks', completedTasks: 0, totalTasks: 0, hasTaskArtifact: false },
        ],
        capabilityCount: 12,
        lastCommitAt: null,
      },
    })
    render(<ProjectCard item={item} onContextMenu={vi.fn()} />, { wrapper })
    expect(screen.getByText(/2 open changes/)).toBeInTheDocument()
    expect(screen.getByText(/add-reader 23\/69/)).toBeInTheDocument()
    expect(screen.getByText(/no-tasks no task list/)).toBeInTheDocument()
  })

  it('says so when a migrated project has no open changes', () => {
    mockUseProjectOverview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeOverview(),
      error: null,
      refetch: vi.fn(),
    })
    const item = makeItem({ status: { reachable: true, condition: 'migrated' as const, openChanges: [], capabilityCount: 3, lastCommitAt: null } })
    render(<ProjectCard item={item} onContextMenu={vi.fn()} />, { wrapper })
    expect(screen.getByText('no open changes')).toBeInTheDocument()
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
