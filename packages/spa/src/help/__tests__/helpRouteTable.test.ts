/**
 * Plan 07-05 Task 1 — helpRouteTable snapshot.
 *
 * Locks the 43-entry route table so any future drift (added stubs without
 * updating HelpLayout NAV, missing redirect, etc.) is caught at commit time.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-CONTEXT.md D-7-06, D-7-13
 */
import { describe, it, expect } from 'vitest'

import { helpRouteTable } from '../helpRouteTable.js'

describe('helpRouteTable', () => {
  it('has the documented entry counts: 1 index + 5 anchor + 32 stub + 4 redirect + 1 catch-all = 43 total', () => {
    const byKind = helpRouteTable.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.kind] = (acc[entry.kind] || 0) + 1
      return acc
    }, {})
    expect(byKind).toEqual({
      index: 1,
      anchor: 5,
      stub: 32,
      redirect: 4,
      catchAll: 1,
    })
    expect(helpRouteTable.length).toBe(43)
  })

  it('all 32 stub paths are unique and prefixed with /help/', () => {
    const stubs = helpRouteTable.filter((e) => e.kind === 'stub')
    const paths = stubs.map((e) => (e as { path: string }).path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const p of paths) {
      expect(p).toMatch(/^\/help\//)
    }
  })

  it('includes the 2 D-7-13 workflow stubs', () => {
    const paths = helpRouteTable.flatMap((e) =>
      e.kind === 'stub' ? [(e as { path: string }).path] : [],
    )
    expect(paths).toContain('/help/workflow/rationalization-table')
    expect(paths).toContain('/help/workflow/red-flags')
  })

  it('reference/shortcuts is an anchor (ready), NOT a stub (HELP-06)', () => {
    const shortcuts = helpRouteTable.find(
      (e) => e.kind === 'anchor' && (e as { path: string }).path === '/help/reference/shortcuts',
    )
    expect(shortcuts).toBeDefined()
    const isStub = helpRouteTable.some(
      (e) => e.kind === 'stub' && (e as { path: string }).path === '/help/reference/shortcuts',
    )
    expect(isStub).toBe(false)
  })

  it('has the 4 section redirects: workflow → /overview, repos → /overview, observability → /overview, operations → /install', () => {
    const redirects = helpRouteTable
      .filter((e) => e.kind === 'redirect')
      .map((e) => e as { kind: 'redirect'; from: string; to: string })
    expect(redirects).toEqual(
      expect.arrayContaining([
        { kind: 'redirect', from: '/help/workflow', to: '/help/workflow/overview' },
        { kind: 'redirect', from: '/help/repos', to: '/help/repos/overview' },
        { kind: 'redirect', from: '/help/observability', to: '/help/observability/overview' },
        { kind: 'redirect', from: '/help/operations', to: '/help/operations/install' },
      ]),
    )
  })

  it('the catchAll entry redirects to /help', () => {
    const catchAll = helpRouteTable.find((e) => e.kind === 'catchAll')
    expect(catchAll).toEqual({ kind: 'catchAll', to: '/help' })
  })
})
