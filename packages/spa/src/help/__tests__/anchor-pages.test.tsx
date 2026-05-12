/**
 * Plan 07-04 Task 5 — anchor MDX render smoke test.
 *
 * Imports each anchor + shortcuts MDX, renders via MDXProvider, asserts
 * structural elements (heading + widget Suspense + Mermaid slot) appear.
 *
 * NOTE: Mock the 3 referenced widget stubs so we don't depend on Plan 07-03's
 * widgets dir being co-resident. (The actual integration is verified in Plan
 * 07-03 stubs-smoke + Plan 07-05 e2e.)
 */
import { MDXProvider } from '@mdx-js/react'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { describe, it, expect, vi } from 'vitest'

// Mock useNavigate for HelpHook (anchor pages don't use HelpHook today, but defensive).
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => () => Promise.resolve(),
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  }
})

// Mock the 3 widget stubs referenced by anchor MDX so we don't lazy-load them.
vi.mock('../widgets/RepoTopologyMap.stub', () => ({
  default: () => <div data-testid="stub-RepoTopologyMap">RepoTopologyMap stub</div>,
}))
vi.mock('../widgets/ScanReportPlayground.stub', () => ({
  default: () => <div data-testid="stub-ScanReportPlayground">ScanReportPlayground stub</div>,
}))
vi.mock('../widgets/MigrationDryRun.stub', () => ({
  default: () => <div data-testid="stub-MigrationDryRun">MigrationDryRun stub</div>,
}))

// Mock mermaid runtime (Plan 07-02 MermaidBlock dynamic imports).
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), run: vi.fn().mockResolvedValue(undefined) },
}))

import { mdxComponents } from '../mdxComponents'
import LandingPage from '../pages/landing.mdx'
import ObservabilityOverview from '../pages/observability/overview.mdx'
import OperationsInstall from '../pages/operations/install.mdx'
import ReposOverview from '../pages/repos/overview.mdx'
import WorkflowOverview from '../pages/workflow/overview.mdx'

function renderMdx(Component: React.ComponentType): ReturnType<typeof render> {
  return render(
    <MDXProvider components={mdxComponents}>
      <Suspense fallback={<div data-testid="suspense-fallback">Loading…</div>}>
        <article className="prose">
          <Component />
        </article>
      </Suspense>
    </MDXProvider>,
  )
}

describe('Anchor MDX pages render smoke', () => {
  it('landing.mdx renders an h1 heading + at least one MermaidBlock slot', () => {
    renderMdx(LandingPage)
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(document.querySelector('pre.mermaid')).toBeInTheDocument()
  })

  it('workflow/overview.mdx renders + has a Mermaid slot', () => {
    renderMdx(WorkflowOverview)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
    expect(document.querySelector('pre.mermaid')).toBeInTheDocument()
  })

  it('repos/overview.mdx renders + dispatches RepoTopologyMap via HelpWidget', async () => {
    renderMdx(ReposOverview)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
    expect(document.querySelector('pre.mermaid')).toBeInTheDocument()
    expect(await screen.findByTestId('stub-RepoTopologyMap')).toBeInTheDocument()
  })

  it('observability/overview.mdx renders 2 Mermaid slots + ScanReportPlayground widget', async () => {
    renderMdx(ObservabilityOverview)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('pre.mermaid').length).toBe(2)
    expect(await screen.findByTestId('stub-ScanReportPlayground')).toBeInTheDocument()
  })

  it('operations/install.mdx renders + dispatches MigrationDryRun (no Mermaid)', async () => {
    renderMdx(OperationsInstall)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('pre.mermaid').length).toBe(0)
    expect(await screen.findByTestId('stub-MigrationDryRun')).toBeInTheDocument()
  })
})
