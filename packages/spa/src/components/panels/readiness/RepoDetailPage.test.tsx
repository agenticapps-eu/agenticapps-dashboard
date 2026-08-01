import React from 'react'
import { fireEvent, render, screen, cleanup, within } from '@testing-library/react'
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
  useEvidence: vi.fn(),
  useRescanRepo: vi.fn(),
  useOpenInEditor: vi.fn(),
}))

import { ApiError } from '../../../lib/api.js'
import {
  useEvidence,
  useOpenInEditor,
  useRepoDetail,
  useRescanRepo,
} from '../../../lib/readinessQueries.js'

import { CHECK_LABELS } from './ReadinessIndicator.js'
import { RepoDetailPage } from './RepoDetailPage.js'

const mockUseRepoDetail = vi.mocked(useRepoDetail)
const mockUseEvidence = vi.mocked(useEvidence)
const mockUseRescanRepo = vi.mocked(useRescanRepo)
const mockUseOpenInEditor = vi.mocked(useOpenInEditor)

const rescan = vi.fn()
const openInEditor = vi.fn()

afterEach(cleanup)
beforeEach(() => {
  routerState.params = { repoId: 'dashboard' }
  rescan.mockClear()
  openInEditor.mockClear()
  mockUseEvidence.mockReturnValue({
    data: undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useEvidence>)
  mockUseRescanRepo.mockReturnValue({
    mutate: rescan,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useRescanRepo>)
  mockUseOpenInEditor.mockReturnValue({
    mutate: openInEditor,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useOpenInEditor>)
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

const EVIDENCE_PATH = 'openspec/specs/repo-readiness/spec.md'

/** A repo whose first check was derived from a file, and its second declared. */
function withEvidence(): RepoDetail {
  const base = detail()
  const checks = base.checks.map((check, index) =>
    index === 0
      ? {
          ...check,
          source: 'derived' as const,
          evidence: { path: EVIDENCE_PATH, commit: 'a'.repeat(40) },
        }
      : index === 1
        ? { ...check, source: 'declared' as const }
        : check,
  ) as unknown as RepoDetail['checks']
  return { ...base, checks }
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

    const name = screen.getByRole('heading', { name: 'agenticapps-dashboard' })
    expect(name).toBeInTheDocument()

    // Scoped to the header: the six blocks state their own observation times,
    // and a repo whose checks all ran at the last commit renders this same
    // string seven times.
    const header = name.closest('header')
    expect(header).not.toBeNull()
    expect(within(header as HTMLElement).getByText(/2026-07-30 09:15 UTC/)).toBeInTheDocument()
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

describe('RepoDetailPage header actions', () => {
  function header(): HTMLElement {
    const el = screen
      .getByRole('heading', { name: 'agenticapps-dashboard' })
      .closest('header')
    if (el === null) throw new Error('no header')
    return el as HTMLElement
  }

  it('offers to rescan, and asks the daemon when it is used', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    fireEvent.click(within(header()).getByRole('button', { name: /rescan/i }))

    expect(rescan).toHaveBeenCalledTimes(1)
  })

  it('offers to open the repo in the editor', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    fireEvent.click(within(header()).getByRole('button', { name: /open in editor/i }))

    expect(openInEditor).toHaveBeenCalledTimes(1)
  })

  it('says when the reading was taken, so a cached answer is tellable from a fresh one', () => {
    // The design critique's strongest finding on the fleet: `generatedAt` was
    // on the wire and rendered nowhere. The same field is on this response.
    loaded(detail())
    render(<RepoDetailPage />)

    expect(within(header()).getByText(/2026-07-31 00:00 UTC/)).toBeInTheDocument()
  })

  it('says an editor is not configured rather than failing silently', () => {
    mockUseOpenInEditor.mockReturnValue({
      mutate: openInEditor,
      isPending: false,
      isError: true,
      error: new ApiError(409, 'req-2', 'HTTP 409', 'editor_not_configured'),
    } as unknown as ReturnType<typeof useOpenInEditor>)
    loaded(detail())
    render(<RepoDetailPage />)

    expect(within(header()).getByText(/EDITOR/)).toBeInTheDocument()
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
    loaded(withEvidence())
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
      // Scoped to the block on purpose. The header is entitled to say when the
      // snapshot was taken; a check block is not entitled to borrow it.
      expect(within(block(id)).queryByText(/2026-07-31/)).not.toBeInTheDocument()
    }
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

  it('offers the evidence file as a control, closed until asked', () => {
    loaded(withEvidence())
    render(<RepoDetailPage />)

    const control = within(block('workflow')).getByRole('button', {
      name: /openspec\/specs\/repo-readiness\/spec\.md/,
    })
    expect(control).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the file through the read route once the control is opened', () => {
    mockUseEvidence.mockReturnValue({
      data: { content: 'the evidence body', mtime: '2026-07-30T09:15:00.000Z', sha256: 'f'.repeat(64) },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useEvidence>)
    loaded(withEvidence())
    render(<RepoDetailPage />)

    const control = within(block('workflow')).getByRole('button', {
      name: /openspec\/specs\/repo-readiness\/spec\.md/,
    })
    fireEvent.click(control)

    expect(control).toHaveAttribute('aria-expanded', 'true')
    expect(within(block('workflow')).getByText(/the evidence body/)).toBeInTheDocument()
  })

  it('names evidence the read route will not serve, but does not offer to open it', () => {
    // The coverage check's default evidence path. The read route allows
    // `.planning`, `.claude` and `openspec` only, so a control here would
    // promise a file the daemon answers with 422 — the spec's "paths already
    // accepted by that read route" is the constraint being honoured.
    const base = detail()
    const checks = base.checks.map((check) =>
      check.id === 'coverage'
        ? {
            ...check,
            evidence: { path: 'coverage/coverage-summary.json', commit: 'b'.repeat(40) },
          }
        : check,
    ) as unknown as RepoDetail['checks']
    loaded({ ...base, checks })
    render(<RepoDetailPage />)

    const coverage = block('coverage')
    expect(within(coverage).getByText(/coverage\/coverage-summary\.json/)).toBeInTheDocument()
    expect(within(coverage).queryAllByRole('button')).toHaveLength(0)
  })

  it('does not claim to know why a file would not open', () => {
    // `isReadableProjectPath` cannot see existence, file mode or symlink
    // containment, so an offered control can still fail — a directory, a
    // deleted file, a symlink out of the repo. Naming one of those causes is
    // guessing, and it will be the wrong guess most of the time.
    mockUseEvidence.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new ApiError(422, 'req-3', 'HTTP 422', 'path_not_allowed'),
    } as unknown as ReturnType<typeof useEvidence>)
    loaded(withEvidence())
    render(<RepoDetailPage />)

    fireEvent.click(
      within(block('workflow')).getByRole('button', { name: /spec\.md/ }),
    )

    expect(within(block('workflow')).queryByText(/may have moved/i)).not.toBeInTheDocument()
    expect(within(block('workflow')).getByText(/could not read/i)).toBeInTheDocument()
  })

  it('offers no control where there is no evidence to open', () => {
    loaded(neverDetail())
    render(<RepoDetailPage />)

    for (const id of CHECK_IDS) {
      expect(within(block(id)).queryAllByRole('button')).toHaveLength(0)
    }
  })

  it('keeps all six on one scrollable page — no tab, dialog, or drawer', () => {
    loaded(detail())
    render(<RepoDetailPage />)

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  })
})
