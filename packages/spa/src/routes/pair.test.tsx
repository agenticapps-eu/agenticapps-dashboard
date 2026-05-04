import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MalformedPairUrl } from './pair-error.js'

// Mock apiFetch and ApiError from lib/api.ts
vi.mock('../lib/api.js', () => {
  class MockApiError extends Error {
    status: number
    requestId: string | undefined
    constructor(status: number, requestId: string | undefined, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.requestId = requestId
    }
  }
  return {
    apiFetch: vi.fn(),
    ApiError: MockApiError,
  }
})

// Mock pairing helpers
vi.mock('../lib/pairing.js', () => ({
  getPairing: vi.fn().mockReturnValue(null),
  setPairing: vi.fn(),
  clearPairing: vi.fn(),
}))

const VALID_TOKEN = 'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344'
const VALID_AGENT = 'http://127.0.0.1:5193'

const mockNavigate = vi.fn().mockResolvedValue(undefined)

// Mock TanStack Router hooks used by PairFlow
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    getRouteApi: () => ({
      useSearch: () => ({ agent: VALID_AGENT, token: VALID_TOKEN }),
    }),
    useNavigate: () => mockNavigate,
  }
})

import { apiFetch, ApiError } from '../lib/api.js'
import { setPairing, clearPairing } from '../lib/pairing.js'
import { PairFlow } from './pair.lazy.js'

const mockApiFetch = vi.mocked(apiFetch)
const mockSetPairing = vi.mocked(setPairing)
const mockClearPairing = vi.mocked(clearPairing)

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PairFlow', () => {
  it('valid pair URL: writes pairing then calls /health then navigates to /', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true, data: { ok: true, version: '1.0.0' } })
    render(<PairFlow />)
    await waitFor(() => {
      expect(mockSetPairing).toHaveBeenCalledOnce()
    })
    expect(mockSetPairing).toHaveBeenCalledWith(
      expect.objectContaining({ agentUrl: VALID_AGENT, token: VALID_TOKEN }),
    )
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    })
  })

  it('schema drift on /health: renders SchemaDriftState and clears pairing', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      drift: { path: 'ok', expected: 'boolean', got: 'string', issues: [] },
    })
    render(<PairFlow />)
    await waitFor(() => {
      expect(mockClearPairing).toHaveBeenCalledOnce()
    })
    expect(screen.getByRole('heading', { name: /Schema drift detected/i })).toBeInTheDocument()
  })

  it('401 from /health: renders "Token rejected" and clears pairing', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, undefined, 'unauthorized'))
    render(<PairFlow />)
    await waitFor(() => {
      expect(mockClearPairing).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Token rejected/i })).toBeInTheDocument()
    })
  })

  it('TypeError from /health (ECONNREFUSED): renders DaemonUnreachableState', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<PairFlow />)
    await waitFor(() => {
      expect(mockClearPairing).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Daemon not running/i })).toBeInTheDocument()
    })
  })
})

describe('MalformedPairUrl', () => {
  it("renders verbatim heading \"This pair URL doesn't look right\"", () => {
    render(<MalformedPairUrl />)
    expect(
      screen.getByRole('heading', { name: /This pair URL doesn't look right/i }),
    ).toBeInTheDocument()
  })
})
