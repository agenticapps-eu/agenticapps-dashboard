import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AgentUrlSchema,
  TokenSchema,
  HealthResponseSchema,
} from '@agenticapps/dashboard-shared'

import { apiFetch, ApiError } from '../lib/api.js'
import { setPairing, clearPairing, getPairing } from '../lib/pairing.js'

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; heading: string; body: string }

export function ManualPairForm() {
  const navigate = useNavigate()
  const existing = getPairing()
  const [agentUrl, setAgentUrl] = useState(existing?.agentUrl ?? '')
  const [token, setToken] = useState(existing?.token ?? '')
  const [agentUrlError, setAgentUrlError] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' })

  const validateAgentUrl = (v: string): string | null => {
    const r = AgentUrlSchema.safeParse(v)
    return r.success
      ? null
      : "This doesn’t look like an agent URL. Use `http://127.0.0.1:5193` or your Tailscale `*.ts.net` host."
  }

  const validateToken = (v: string): string | null => {
    const r = TokenSchema.safeParse(v)
    return r.success
      ? null
      : "Token format doesn’t match. Copy it again from the agent’s startup banner."
  }

  const canSubmit =
    agentUrl.length > 0 &&
    token.length > 0 &&
    agentUrlError === null &&
    tokenError === null &&
    AgentUrlSchema.safeParse(agentUrl).success &&
    TokenSchema.safeParse(token).success

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    // WR-04: re-entry guard — protects against Enter-key resubmission while
    // a previous submission is still in-flight (aria-disabled alone is a
    // screen-reader hint and does NOT block keyboard form submission).
    if (status.kind === 'submitting') return
    const aErr = validateAgentUrl(agentUrl)
    const tErr = validateToken(token)
    setAgentUrlError(aErr)
    setTokenError(tErr)
    if (aErr || tErr) return

    setStatus({ kind: 'submitting' })
    setPairing({ agentUrl, token, pairedAt: new Date().toISOString() })
    try {
      const result = await apiFetch('/health', HealthResponseSchema)
      if (!result.ok) {
        clearPairing()
        setStatus({
          kind: 'error',
          heading: 'Schema drift on /health',
          body: 'Update the agent (`npx @agenticapps/dashboard-agent@latest`) and try again.',
        })
        return
      }
      if (!result.data.ok) {
        clearPairing()
        setStatus({
          kind: 'error',
          heading: 'Pairing failed',
          body: 'Try `agentic-dashboard status` in your terminal.',
        })
        return
      }
      setStatus({ kind: 'success' })
    } catch (err) {
      clearPairing()
      if (err instanceof ApiError && err.status === 401) {
        setStatus({
          kind: 'error',
          heading: 'Token rejected',
          body: "Re-check the token in the agent’s startup banner.",
        })
      } else if (err instanceof TypeError) {
        setStatus({
          kind: 'error',
          heading: "Couldn’t reach the agent",
          body: 'Try `agentic-dashboard status` in your terminal.',
        })
      } else {
        setStatus({
          kind: 'error',
          heading: 'Pairing failed',
          body: err instanceof ApiError ? `HTTP ${err.status}.` : 'Unknown error.',
        })
      }
    }
  }

  useEffect(() => {
    if (status.kind !== 'success') return
    const t = window.setTimeout(() => {
      void navigate({ to: '/' })
    }, 800)
    return () => window.clearTimeout(t)
  }, [status, navigate])

  return (
    <section className="rounded-card border border-border-subtle bg-card-bg p-6">
      <h2 className="mb-6 text-xl font-semibold leading-snug text-text-primary">Manual pair</h2>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Agent URL field */}
        <div className="space-y-2">
          <label htmlFor="agent-url" className="text-sm font-semibold text-text-primary">
            Agent URL
          </label>
          <input
            id="agent-url"
            type="text"
            value={agentUrl}
            onChange={(e) => {
              setAgentUrl(e.target.value)
              if (agentUrlError) setAgentUrlError(null)
            }}
            onBlur={() => setAgentUrlError(validateAgentUrl(agentUrl))}
            readOnly={status.kind === 'submitting'}
            aria-invalid={agentUrlError !== null}
            aria-describedby="agent-url-helper"
            placeholder="http://127.0.0.1:5193"
            className="w-full rounded-md border border-border-subtle bg-card-bg-hover px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          />
          <p
            id="agent-url-helper"
            className={
              agentUrlError
                ? 'flex items-center gap-1 text-sm text-status-error'
                : 'text-sm text-text-secondary'
            }
          >
            {agentUrlError && <AlertTriangle size={14} aria-hidden="true" />}
            {agentUrlError ?? 'Loopback or *.ts.net only.'}
          </p>
        </div>

        {/* Token field */}
        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-semibold text-text-primary">
            Token
          </label>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              if (tokenError) setTokenError(null)
            }}
            onBlur={() => setTokenError(validateToken(token))}
            readOnly={status.kind === 'submitting'}
            aria-invalid={tokenError !== null}
            aria-describedby="token-helper"
            placeholder="a1b2c3d4-…-z9y8x7w6"
            className="w-full rounded-md border border-border-subtle bg-card-bg-hover px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          />
          <p
            id="token-helper"
            className={
              tokenError
                ? 'flex items-center gap-1 text-sm text-status-error'
                : 'text-sm text-text-secondary'
            }
          >
            {tokenError && <AlertTriangle size={14} aria-hidden="true" />}
            {tokenError ?? "71 characters, dash-separated. Find it in the agent’s startup banner."}
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || status.kind === 'submitting'}
          aria-disabled={!canSubmit || status.kind === 'submitting'}
          className={[
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
            canSubmit && status.kind !== 'submitting'
              ? 'bg-accent text-white hover:bg-accent-hover'
              : 'cursor-not-allowed bg-card-bg-hover text-text-tertiary opacity-50',
          ].join(' ')}
        >
          {status.kind === 'submitting' && (
            <Loader2
              size={14}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {status.kind === 'submitting' ? 'Connecting…' : 'Save & connect'}
        </button>

        {/* Form-level alerts */}
        {status.kind === 'error' && (
          <div
            role="alert"
            className="mt-4 rounded-md border-l-2 border-l-status-warning bg-card-bg-hover p-4"
          >
            <h3 className="text-sm font-semibold text-text-primary">{status.heading}</h3>
            <p className="mt-1 text-sm text-text-secondary">{status.body}</p>
          </div>
        )}
        {status.kind === 'success' && (
          <div
            role="alert"
            className="mt-4 rounded-md border-l-2 border-l-status-success bg-card-bg-hover p-4"
          >
            <h3 className="text-sm font-semibold text-text-primary">Connected.</h3>
            <p className="mt-1 text-sm text-text-secondary">Redirecting&hellip;</p>
          </div>
        )}
      </form>
    </section>
  )
}
