import React from 'react'
import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_IDS,
  computeReady,
  type CheckId,
  type CheckStatus,
  type RepoDetail,
  type RepoDetailResponse,
} from '@agenticapps/dashboard-shared'

const routerState = vi.hoisted(() => ({ params: { repoId: 'dashboard' } }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useParams: () => routerState.params }
})
vi.mock('../../../lib/readinessQueries.js', () => ({
  useFleet: vi.fn(),
  useRepoDetail: vi.fn(),
}))

import { ApiError } from '../../../lib/api.js'
import { useRepoDetail } from '../../../lib/readinessQueries.js'

import { CHECK_LABELS } from './ReadinessIndicator.js'
import { RepoDetailPage } from './RepoDetailPage.js'

const mockUseRepoDetail = vi.mocked(useRepoDetail)

afterEach(cleanup)
beforeEach(() => {
  routerState.params = { repoId: 'dashboard' }
})

function detail(over: Partial<RepoDetail> = {}): RepoDetail {
  const checks = CHECK_IDS.map((id) => ({
    id,
    status: 'ok' as CheckStatus,
    source: 'derived' as const,
    at: Date.UTC(2026, 6, 30, 9, 15),
    value: null,
    threshold: null,
    summary: '',
    evidence: null,
    error: null,
    remedy: 'Nothing to do.',
  })) as unknown as RepoDetail['checks']

  return {
    id: 'dashboard',
    name: 'agenticapps-dashboard',
    family: 'agenticapps',
    ready: computeReady(checks),
    lastCommitAt: Date.UTC(2026, 6, 30, 9, 15),
    checks,
    notice: null,
    ...over,
  }
}

/**
 * A repo where nothing has ever run — the state §10's last task line names, and
 * the one every young repo actually arrives in. Six distinct remedies, because
 * six copies of "run it" would satisfy a non-empty assertion while telling the
 * reader nothing.
 */
const NEVER_REMEDIES: Record<CheckId, string> = {
  workflow: 'No workflow skill was found. Install it with /setup-agenticapps-workflow.',
  spec: 'No openspec directory was found. Initialise one with openspec init.',
  'code-review':
    'No REVIEW.md was found. Run the code review and commit its verdict as REVIEW.md in the change directory under openspec/changes.',
  'security-review':
    'No SECURITY.md was found. Run the security review and commit its verdict as SECURITY.md in the change directory under openspec/changes.',
  'pen-test':
    'No penetration test is declared. Record one in .agenticapps/readiness.json with the date it expires.',
  coverage: 'No coverage artifact was found. Emit one from the test run and commit it.',
}

function neverDetail(): RepoDetail {
  const checks = CHECK_IDS.map((id) => ({
    id,
    status: 'never' as CheckStatus,
    source: 'derived' as const,
    at: null,
    value: null,
    threshold: null,
    summary: '',
    evidence: null,
    error: null,
    remedy: NEVER_REMEDIES[id],
  })) as unknown as RepoDetail['checks']

  return {
    id: 'fresh',
    name: 'fresh-repo',
    family: 'agenticapps',
    ready: computeReady(checks),
    lastCommitAt: null,
    checks,
    notice: null,
  }
}

function loaded(repo: RepoDetail): void {
  const data: RepoDetailResponse = { generatedAt: Date.UTC(2026, 6, 31), repo }
  mockUseRepoDetail.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRepoDetail>)
}

describe('RepoDetailPage header', () => {
  it('names the repo and states when it last changed', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    expect(
      screen.getByRole('heading', { name: 'agenticapps-dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/2026-07-30 09:15 UTC/)).toBeInTheDocument()
  })

  it('shows the six checks in the full variant, labelled and unlinked', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    const group = screen.getByRole('group', { name: /agenticapps-dashboard/ })
    expect(within(group).getAllByRole('figure')).toHaveLength(CHECK_IDS.length)
    // The full variant names each check in the cell, so the detail needs no
    // column headers to say which is which.
    for (const id of CHECK_IDS) {
      expect(within(group).getByText(CHECK_LABELS[id])).toBeInTheDocument()
    }
    // Every cell already points at this page; linking them would be noise.
    expect(within(group).queryAllByRole('link')).toHaveLength(0)
  })

  it('states readiness and any readiness-file notice in the header', () => {
    loaded(
      detail({
        notice: {
          code: 'readiness-file-unparsable',
          message: '.agenticapps/readiness.json is not valid JSON',
        },
      }),
    )
    render(<RepoDetailPage />)

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(
      screen.getByText(/\.agenticapps\/readiness\.json is not valid JSON/),
    ).toBeInTheDocument()
  })

  it('says a repo is not registered rather than reporting a broken daemon', () => {
    // A 404 here is an answer, not a failure: the daemon replies from the
    // registry alone and never joins the identifier to a path.
    mockUseRepoDetail.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(404, 'req-1', 'HTTP 404', 'project_not_found'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRepoDetail>)
    render(<RepoDetailPage />)

    expect(screen.getByText(/not registered/i)).toBeInTheDocument()
  })
})

/** The six blocks, in DOM order, identified by the anchor a fleet cell targets. */
function blockIds(): string[] {
  return Array.from(document.querySelectorAll('section[id]')).map((el) => el.id)
}

function block(id: CheckId): HTMLElement {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`no block for ${id}`)
  return el as HTMLElement
}

describe('RepoDetailPage evidence blocks', () => {
  it('renders one block per check, in the fixed order', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    expect(blockIds()).toEqual([...CHECK_IDS])
  })

  it('anchors each block at its own check id, which is what a fleet cell targets', () => {
    // ReadinessIndicator links with `hash={check.id}`. If these two ever
    // disagree, selecting a cell lands on the page but not on the check.
    loaded(detail())
    render(<RepoDetailPage />)

    for (const id of CHECK_IDS) {
      expect(within(block(id)).getByRole('heading', { name: CHECK_LABELS[id] })).toBeInTheDocument()
    }
  })

  it('states each status in words with the time it was observed', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    const workflow = block('workflow')
    expect(within(workflow).getByText(/passing/)).toBeInTheDocument()
    expect(within(workflow).getByText(/2026-07-30 09:15 UTC/)).toBeInTheDocument()
  })

  it('names where a derived value came from, and names the readiness file for a declared one', () => {
    const base = detail()
    const checks = base.checks.map((check, index) =>
      index === 0
        ? {
            ...check,
            source: 'derived' as const,
            evidence: { path: 'openspec/specs/repo-readiness/spec.md', commit: 'a'.repeat(40) },
          }
        : index === 1
          ? { ...check, source: 'declared' as const }
          : check,
    ) as unknown as RepoDetail['checks']
    loaded({ ...base, checks })
    render(<RepoDetailPage />)

    expect(
      within(block('workflow')).getByText(/openspec\/specs\/repo-readiness\/spec\.md/),
    ).toBeInTheDocument()
    expect(within(block('spec')).getByText(/readiness\.json/)).toBeInTheDocument()
  })

  it('renders an em dash rather than inventing a timestamp or a path', () => {
    // `generatedAt` is on the same response. Substituting it for an observation
    // that never happened is the one thing this must not do.
    loaded(neverDetail())
    render(<RepoDetailPage />)

    for (const id of CHECK_IDS) {
      expect(within(block(id)).getAllByText('—').length).toBeGreaterThan(0)
    }
    expect(screen.queryByText(/2026-07-31/)).not.toBeInTheDocument()
  })

  it('gives a repo where nothing has ever run six usable sentences', () => {
    loaded(neverDetail())
    render(<RepoDetailPage />)

    const sentences = CHECK_IDS.map((id) =>
      within(block(id)).getByText(NEVER_REMEDIES[id]).textContent?.trim() ?? '',
    )
    expect(sentences.filter((text) => text !== '')).toHaveLength(CHECK_IDS.length)
    expect(new Set(sentences).size).toBe(CHECK_IDS.length)
  })

  it('keeps all six on one scrollable page — no tab, dialog, or drawer', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  })
})
