/**
 * PathDriftPanel.test.tsx — drift entries + Fix-path affordance (Plan 12-03 / D-12-20, D-12-21).
 *
 * Tests cover:
 * - empty state: returns null when drifted=[]
 * - count + collapsible header chevron
 * - per-entry: project name + storedPath + (suggestedPath OR manual paste input)
 * - Fix-path button: enabled only when suggestedPath or manual input is non-empty
 * - mutation flow: POST body shape; success toast (green); error toast (red, mapped)
 * - in-flight semantics: button disabled + aria-busy=true for that row
 * - concurrent: two simultaneous clicks → independent in-flight states (Phase 11.2 Set)
 * - SECURITY: no dangerous inner-html prop; maxLength=4096 on paste input
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { PathDriftPanel } from './PathDriftPanel.js'
import { ToastProvider } from '../../ui/Toast.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const DANGEROUS_INNER_HTML = `dangerously${'Set'}InnerHTML`

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(ToastProvider, null, children),
    )
  return { qc, wrapper }
}

const REGISTRY_ENTRY_BODY = {
  id: 'agenticapps/agenticapps-dashboard',
  name: 'agenticapps-dashboard',
  root: '/new/path',
  client: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  tags: [],
}

function makeFetchResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

type DriftEntry = {
  id: string
  storedPath: string
  suggestedPath: string | null
  reason: 'missing' | 'symlink-target-changed' | 'git-remote-changed'
}

const ONE_WITH_SUGGESTION: DriftEntry[] = [
  {
    id: 'agenticapps/agenticapps-dashboard',
    storedPath: '/old/agenticapps-dashboard',
    suggestedPath: '/new/agenticapps-dashboard',
    reason: 'missing',
  },
]

const ONE_WITHOUT_SUGGESTION: DriftEntry[] = [
  {
    id: 'factiv/cparx',
    storedPath: '/old/cparx',
    suggestedPath: null,
    reason: 'missing',
  },
]

const TWO_WITH_SUGGESTIONS: DriftEntry[] = [
  {
    id: 'agenticapps/agenticapps-dashboard',
    storedPath: '/old/a',
    suggestedPath: '/new/a',
    reason: 'missing',
  },
  {
    id: 'agenticapps/claude-workflow',
    storedPath: '/old/b',
    suggestedPath: '/new/b',
    reason: 'missing',
  },
]

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PathDriftPanel', () => {
  it('P1: returns null when drifted is empty', () => {
    const { wrapper } = makeWrapper()
    const { container } = render(<PathDriftPanel drifted={[]} />, { wrapper })
    expect(container.innerHTML.trim()).toBe('')
  })

  it('P2: renders count when drifted has entries', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={TWO_WITH_SUGGESTIONS} />, { wrapper })
    expect(screen.getByText(/2 drifted/i)).toBeTruthy()
  })

  it('P3: collapsible — clicking chevron toggles entries visibility', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    // Entries visible initially (auto-expand when present)
    expect(screen.queryByText('/old/agenticapps-dashboard')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: /toggle/i })
    fireEvent.click(toggle)
    // After collapse, entry row is hidden
    expect(screen.queryByText('/old/agenticapps-dashboard')).toBeNull()
  })

  it('P4: per-entry shows project id + storedPath as JSX text (escaping defence)', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    expect(screen.getByText('agenticapps/agenticapps-dashboard')).toBeTruthy()
    expect(screen.getByText('/old/agenticapps-dashboard')).toBeTruthy()
  })

  it('P5: per-entry with suggestedPath — Fix path button is enabled', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    const btn = screen.getByRole('button', { name: /fix path/i })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('P6: per-entry WITHOUT suggestedPath — input shown, button disabled until non-empty', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITHOUT_SUGGESTION} />, { wrapper })
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeTruthy()
    const btn = screen.getByRole('button', { name: /fix path/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '/manual/new/path' } })
    expect(btn.disabled).toBe(false)
  })

  it('P7: clicking Fix path — POSTs to /api/admin/registry/fix-path with {id, newPath}', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REGISTRY_ENTRY_BODY))
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    const btn = screen.getByRole('button', { name: /fix path/i })
    await act(async () => {
      fireEvent.click(btn)
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/admin/registry/fix-path')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as { id: string; newPath: string }
    expect(body.id).toBe('agenticapps/agenticapps-dashboard')
    expect(body.newPath).toBe('/new/agenticapps-dashboard')
  })

  it('P8: successful mutation — shows green success toast', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REGISTRY_ENTRY_BODY))
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    const btn = screen.getByRole('button', { name: /fix path/i })
    await act(async () => {
      fireEvent.click(btn)
    })
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
    })
    const toast = screen.getByRole('status')
    expect(toast.textContent).toMatch(/Fixed.*agenticapps/i)
  })

  it('P9: error mutation — shows red error toast with mapped message', async () => {
    mockFetch.mockReturnValue(
      makeFetchResponse(
        { ok: false, error: 'newPath_blocked', requestId: 'req-1' },
        422,
      ),
    )
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    const btn = screen.getByRole('button', { name: /fix path/i })
    await act(async () => {
      fireEvent.click(btn)
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    const toast = screen.getByRole('alert')
    // mapped error string (NOT raw error.message which could leak FS paths)
    // After the apiFetch JSON-body fix, the specific code surfaces; assert
    // BOTH the generic prefix AND the code-specific copy.
    expect(toast.textContent).toMatch(/Failed to fix path/i)
    expect(toast.textContent).toMatch(/blocked/i)
  })

  // P9a..P9d: each 422 code maps to its specific user-facing message.
  // Regression for the dead-code bug where extractErrorCode only read
  // HTTP status (429/404) and ALL 422 codes collapsed to "Fix failed".
  const code422 = [
    { code: 'newPath_outside_family_roots', expected: /outside the family roots/i },
    { code: 'newPath_unresolvable', expected: /does not exist on disk/i },
    { code: 'invalid_request', expected: /invalid request/i },
  ] as const

  for (const { code, expected } of code422) {
    it(`P9-${code}: maps 422 ${code} to specific toast copy`, async () => {
      mockFetch.mockReturnValue(
        makeFetchResponse({ ok: false, error: code, requestId: 'req-1' }, 422),
      )
      const { wrapper } = makeWrapper()
      render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
      const btn = screen.getByRole('button', { name: /fix path/i })
      await act(async () => {
        fireEvent.click(btn)
      })
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy()
      })
      const toast = screen.getByRole('alert')
      expect(toast.textContent).toMatch(/Failed to fix path/i)
      expect(toast.textContent).toMatch(expected)
    })
  }

  it('P10: in-flight — button disabled + aria-busy=true for that row', async () => {
    // Defer the fetch resolution so we can observe the in-flight state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolverHolder: { fn: ((v: unknown) => void) | null } = { fn: null }
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverHolder.fn = resolve
        }),
    )
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITH_SUGGESTION} />, { wrapper })
    const btn = screen.getByRole('button', { name: /fix path/i }) as HTMLButtonElement
    act(() => {
      fireEvent.click(btn)
    })
    // While in-flight: button disabled + aria-busy=true
    await waitFor(() => {
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('aria-busy')).toBe('true')
    })
    // Resolve to let test clean up
    resolverHolder.fn?.({
      ok: true,
      status: 200,
      json: () => Promise.resolve(REGISTRY_ENTRY_BODY),
      clone: () => ({ json: () => Promise.resolve(REGISTRY_ENTRY_BODY) }),
    })
    await waitFor(() => expect(btn.disabled).toBe(false))
  })

  it('P11: concurrent — two clicks on different rows produce independent in-flight states', async () => {
    const resolvers: Array<(v: unknown) => void> = []
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={TWO_WITH_SUGGESTIONS} />, { wrapper })
    const btns = screen.getAllByRole('button', { name: /fix path/i }) as HTMLButtonElement[]
    expect(btns.length).toBe(2)
    act(() => {
      fireEvent.click(btns[0]!)
    })
    act(() => {
      fireEvent.click(btns[1]!)
    })
    await waitFor(() => {
      expect(btns[0]!.disabled).toBe(true)
      expect(btns[1]!.disabled).toBe(true)
    })
    // Resolve first row only — second row stays in-flight
    resolvers[0]?.({
      ok: true,
      status: 200,
      json: () => Promise.resolve(REGISTRY_ENTRY_BODY),
      clone: () => ({ json: () => Promise.resolve(REGISTRY_ENTRY_BODY) }),
    })
    await waitFor(() => {
      expect(btns[0]!.disabled).toBe(false)
      expect(btns[1]!.disabled).toBe(true)
    })
    // Cleanup: resolve second
    resolvers[1]?.({
      ok: true,
      status: 200,
      json: () => Promise.resolve(REGISTRY_ENTRY_BODY),
      clone: () => ({ json: () => Promise.resolve(REGISTRY_ENTRY_BODY) }),
    })
    await waitFor(() => expect(btns[1]!.disabled).toBe(false))
  })

  it('P12: paste input enforces maxLength=4096 (T-12-INPUT-OVERFLOW defence-in-depth)', () => {
    const { wrapper } = makeWrapper()
    render(<PathDriftPanel drifted={ONE_WITHOUT_SUGGESTION} />, { wrapper })
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.getAttribute('maxlength')).toBe('4096')
  })

  it('P13: SECURITY — file does NOT contain the dangerous inner-html prop (T-12-XSS)', async () => {
    const source = await loadSource('src/components/panels/conformance/PathDriftPanel.tsx')
    expect(source.includes(DANGEROUS_INNER_HTML)).toBe(false)
  })

  it('P14: SECURITY — no hex literals in PathDriftPanel.tsx', async () => {
    const source = await loadSource('src/components/panels/conformance/PathDriftPanel.tsx')
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })

  it('P15: implementation uses inFlightRefreshes Set pattern (Phase 11.2)', async () => {
    const source = await loadSource('src/components/panels/conformance/PathDriftPanel.tsx')
    // The implementation must reference inFlightRefreshes at least twice
    // (state declaration + read-site at minimum).
    const matches = source.match(/inFlightRefreshes/g)
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

async function loadSource(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.resolve(process.cwd(), 'packages/spa', rel),
  ]
  for (const c of candidates) {
    try {
      return await fs.readFile(c, 'utf8')
    } catch {
      // try next candidate
    }
  }
  throw new Error(`loadSource: cannot locate ${rel} (cwd=${process.cwd()})`)
}
