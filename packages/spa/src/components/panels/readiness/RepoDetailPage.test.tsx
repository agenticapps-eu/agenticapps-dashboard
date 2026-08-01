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
