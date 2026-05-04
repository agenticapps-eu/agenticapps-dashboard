import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError , apiFetch } from '../lib/api.js'

import { ManualPairForm } from './ManualPairForm.js'


// Mock useNavigate from @tanstack/react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock apiFetch
vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    requestId: string | undefined
    constructor(status: number, requestId: string | undefined, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.requestId = requestId
    }
  },
}))

const mockApiFetch = vi.mocked(apiFetch)

// Valid D-13 token: 8 groups of 8 hex chars separated by dashes (71 chars total)
const VALID_TOKEN = 'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344'
const VALID_URL = 'http://127.0.0.1:5193'

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
  mockApiFetch.mockReset()
  vi.useRealTimers()
})

describe('ManualPairForm', () => {
  it("renders heading 'Manual pair' verbatim", () => {
    render(<ManualPairForm />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Manual pair')
  })

  it('submit button is aria-disabled when both fields empty', () => {
    render(<ManualPairForm />)
    const button = screen.getByRole('button', { name: /Save & connect/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('submit button enables when both fields contain valid agentUrl + token', async () => {
    const user = userEvent.setup()
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    const button = screen.getByRole('button', { name: /Save & connect/i })
    expect(button).toHaveAttribute('aria-disabled', 'false')
  })

  it("blur on invalid agent URL surfaces verbatim error containing 'doesn’t look like an agent URL'", async () => {
    const user = userEvent.setup()
    render(<ManualPairForm />)
    const input = screen.getByLabelText(/Agent URL/i)
    await user.type(input, 'http://evil.com')
    await user.tab()
    expect(screen.getByText(/doesn’t look like an agent URL/)).toBeInTheDocument()
  })

  it("blur on invalid token surfaces verbatim error containing 'Token format doesn’t match'", async () => {
    const user = userEvent.setup()
    render(<ManualPairForm />)
    const input = screen.getByLabelText(/^Token$/i)
    await user.type(input, 'badtoken')
    await user.tab()
    expect(screen.getByText(/Token format doesn’t match/)).toBeInTheDocument()
  })

  it("valid submit calls apiFetch with /health, persists pairing, shows 'Connected.' on success", async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ ok: true, data: { ok: true, version: '0.1.0' } })
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Connected.')).toBeInTheDocument()
    })
    expect(screen.getByText(/Redirecting/)).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledWith('/health', expect.anything())
  })

  it("401 from /health surfaces 'Token rejected' and 'Re-check the token' verbatim", async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, undefined, 'unauthorized'))
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Token rejected')).toBeInTheDocument()
    })
    expect(screen.getByText(/Re-check the token/)).toBeInTheDocument()
  })

  it("TypeError surfaces 'Couldn’t reach the agent' verbatim", async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Couldn’t reach the agent')).toBeInTheDocument()
    })
  })

  it("schema drift (ok:false from apiFetch) surfaces 'Schema drift on /health' and 'Update the agent' verbatim", async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      drift: { path: 'ok', expected: 'boolean', got: 'undefined', issues: [] },
    })
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Schema drift on /health')).toBeInTheDocument()
    })
    expect(screen.getByText(/Update the agent/)).toBeInTheDocument()
    expect(screen.getByText(/npx @agenticapps\/dashboard-agent@latest/)).toBeInTheDocument()
  })

  it("daemon ok=false surfaces 'Pairing failed' and 'Try agentic-dashboard status' verbatim", async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      data: { ok: false, version: '0.1.0' },
    })
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Pairing failed')).toBeInTheDocument()
    })
    expect(screen.getByText(/agentic-dashboard status/)).toBeInTheDocument()
  })

  it('submitting state: button shows Connecting… AND inputs are readOnly (not disabled)', async () => {
    const user = userEvent.setup()
    // Create a promise that we control so the submit stays in-flight
    let resolveSubmit!: (value: unknown) => void
    const submitPromise = new Promise((resolve) => {
      resolveSubmit = resolve
    })
    mockApiFetch.mockReturnValueOnce(submitPromise as ReturnType<typeof apiFetch>)
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    // Check in-flight state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connecting/i })).toBeInTheDocument()
    })
    const urlInput = screen.getByLabelText(/Agent URL/i) as HTMLInputElement
    const tokenInput = screen.getByLabelText(/^Token$/i) as HTMLInputElement
    expect(urlInput.readOnly).toBe(true)
    expect(tokenInput.readOnly).toBe(true)
    // Cleanup
    resolveSubmit({ ok: true, data: { ok: true, version: '0' } })
  })

  it('WR-04: pressing Enter while a submit is in-flight does not fire a second apiFetch', async () => {
    const user = userEvent.setup()
    let resolveSubmit!: (value: unknown) => void
    const submitPromise = new Promise((resolve) => {
      resolveSubmit = resolve
    })
    mockApiFetch.mockReturnValueOnce(submitPromise as ReturnType<typeof apiFetch>)
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    // First submit (kicks off the in-flight request)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connecting/i })).toBeInTheDocument()
    })
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    // Press Enter while the token field is focused — must NOT trigger a second submit
    const tokenInput = screen.getByLabelText(/^Token$/i)
    tokenInput.focus()
    await user.keyboard('{Enter}')
    // apiFetch must still have been called only once
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    // Cleanup
    resolveSubmit({ ok: true, data: { ok: true, version: '0' } })
  })

  it('after success state, navigates to / after ~800ms', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ ok: true, data: { ok: true, version: '0.1.0' } })
    render(<ManualPairForm />)
    await user.type(screen.getByLabelText(/Agent URL/i), VALID_URL)
    await user.type(screen.getByLabelText(/^Token$/i), VALID_TOKEN)
    await user.click(screen.getByRole('button', { name: /Save & connect/i }))
    await waitFor(() => {
      expect(screen.getByText('Connected.')).toBeInTheDocument()
    })
    // Wait for the 800ms navigation timer
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
      },
      { timeout: 2000 },
    )
  })
})
