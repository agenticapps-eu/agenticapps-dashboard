/**
 * HelpLayout — chrome for every /help/* page.
 *
 * Sidebar (sections + pages) + main content area. Mobile collapses sidebar
 * to a drawer toggled by the header hamburger.
 *
 * Source: ~/Documents/.../HelpLayout.tsx (translated from the migration's
 * NavLink/Outlet primitives to @tanstack/react-router Link+useRouterState+Outlet,
 * with all shadcn tokens translated to tokens.css names per Plan 07-02 token
 * translation table).
 *
 * NAV deltas vs the source migration:
 *   - Workflow adds 2 stubs at the end: rationalization-table, red-flags (D-7-13).
 *   - Reference adds "Keyboard shortcuts" as the FIRST entry, status: ready,
 *     path: /help/reference/shortcuts (HELP-06).
 */
import { useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Menu, Search, X } from 'lucide-react'

interface NavItem {
  label: string
  path: string
  status?: 'ready' | 'stub'
}

interface NavSection {
  label: string
  emoji: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Workflow',
    emoji: '📐',
    items: [
      { label: 'Overview', path: '/help/workflow/overview', status: 'ready' },
      { label: 'Commitment ritual', path: '/help/workflow/commitment-ritual', status: 'stub' },
      { label: 'Gates', path: '/help/workflow/gates', status: 'stub' },
      { label: 'Superpowers', path: '/help/workflow/superpowers', status: 'stub' },
      { label: 'GSD', path: '/help/workflow/gsd', status: 'stub' },
      { label: 'gstack', path: '/help/workflow/gstack', status: 'stub' },
      { label: 'Impeccable', path: '/help/workflow/impeccable', status: 'stub' },
      { label: 'Two-stage review', path: '/help/workflow/two-stage-review', status: 'stub' },
      { label: 'Verification', path: '/help/workflow/verification', status: 'stub' },
      { label: 'ADRs', path: '/help/workflow/adrs', status: 'stub' },
      // D-7-13 additions
      {
        label: 'Rationalization table',
        path: '/help/workflow/rationalization-table',
        status: 'stub',
      },
      { label: 'Red flags', path: '/help/workflow/red-flags', status: 'stub' },
    ],
  },
  {
    label: 'Repositories',
    emoji: '📦',
    items: [
      { label: 'Overview', path: '/help/repos/overview', status: 'ready' },
      { label: 'core', path: '/help/repos/core', status: 'stub' },
      { label: 'claude-workflow', path: '/help/repos/claude', status: 'stub' },
      { label: 'pi-workflow', path: '/help/repos/pi', status: 'stub' },
      { label: 'codex-workflow', path: '/help/repos/codex', status: 'stub' },
      { label: 'dashboard', path: '/help/repos/dashboard', status: 'stub' },
      { label: 'Client projects', path: '/help/repos/projects', status: 'stub' },
    ],
  },
  {
    label: 'Observability',
    emoji: '📡',
    items: [
      { label: 'Overview', path: '/help/observability/overview', status: 'ready' },
      { label: 'Spec §10', path: '/help/observability/spec-section-10', status: 'stub' },
      { label: 'Stack templates', path: '/help/observability/stacks', status: 'stub' },
      { label: 'Install', path: '/help/observability/install', status: 'stub' },
      { label: 'Scan', path: '/help/observability/scan', status: 'stub' },
      { label: 'Apply', path: '/help/observability/apply', status: 'stub' },
      { label: 'Policy', path: '/help/observability/policy', status: 'stub' },
      { label: 'Pi & Codex status', path: '/help/observability/pi-codex-status', status: 'stub' },
    ],
  },
  {
    label: 'Operations',
    emoji: '⚙️',
    items: [
      { label: 'Install', path: '/help/operations/install', status: 'ready' },
      { label: 'Update', path: '/help/operations/update', status: 'stub' },
      { label: 'Slash commands', path: '/help/operations/slash-commands', status: 'stub' },
      { label: 'Troubleshooting', path: '/help/operations/troubleshooting', status: 'stub' },
      { label: 'Migration runbook', path: '/help/operations/migration-runbook', status: 'stub' },
    ],
  },
  {
    label: 'Reference',
    emoji: '📚',
    items: [
      // HELP-06: Keyboard shortcuts moved from old /help into docs site; first entry, ready.
      { label: 'Keyboard shortcuts', path: '/help/reference/shortcuts', status: 'ready' },
      { label: 'Glossary', path: '/help/reference/glossary', status: 'stub' },
      { label: 'ADR index', path: '/help/reference/adr-index', status: 'stub' },
      { label: 'Changelog', path: '/help/reference/changelog', status: 'stub' },
      { label: 'Contributing', path: '/help/reference/contributing', status: 'stub' },
    ],
  },
]

export function HelpLayout(): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-screen bg-app-bg text-text-primary">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border-subtle bg-app-bg px-4 py-3">
        <Link to="/help" className="font-semibold text-lg text-text-primary">
          AgenticApps
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setSidebarOpen((s) => !s)}
          className="rounded-md p-2 hover:bg-card-bg-hover"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'block' : 'hidden'} md:block fixed md:sticky inset-y-0 md:top-0 left-0 z-30 h-screen w-72 shrink-0 overflow-y-auto border-r border-border-subtle bg-app-bg px-4 py-6`}
          aria-label="Help navigation"
        >
          <div className="hidden md:flex items-center gap-2 mb-6">
            <Link to="/help" className="font-semibold text-xl text-text-primary">
              AgenticApps
            </Link>
            <span className="text-xs text-text-tertiary rounded bg-sidebar-bg px-1.5 py-0.5">
              help
            </span>
          </div>

          {/* Search placeholder — wires to MiniSearch in v1.1 */}
          <div className="mb-4 relative">
            <Search size={14} className="absolute left-2 top-2 text-text-tertiary" />
            <input
              type="search"
              placeholder="Search docs…"
              className="w-full rounded-md border border-border-subtle bg-app-bg py-1.5 pl-7 pr-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
              disabled
              aria-label="Search documentation (coming in v1.1)"
            />
          </div>

          <nav className="space-y-6 text-sm">
            {NAV.map((section) => (
              <div key={section.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <span className="mr-1.5">{section.emoji}</span>
                  {section.label}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.path
                    const className = `block rounded-md px-2 py-1 ${
                      isActive
                        ? 'bg-accent-bg text-accent font-medium'
                        : 'text-text-secondary hover:bg-card-bg-hover/60 hover:text-text-primary'
                    }`
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={className}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {item.label}
                          {item.status === 'stub' && (
                            <span className="ml-1.5 text-[10px] text-text-tertiary">(soon)</span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 py-8 md:px-12 md:py-12 max-w-3xl">
          <article className="prose prose-slate dark:prose-invert max-w-none">
            <Outlet />
          </article>
        </main>
      </div>
    </div>
  )
}
