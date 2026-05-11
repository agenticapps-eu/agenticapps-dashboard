import { useEffect, useState } from 'react'
import { createLazyRoute, useNavigate, getRouteApi } from '@tanstack/react-router'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'

import { apiFetch, ApiError, type DriftIssue } from '../lib/api.js'
import { setPairing, clearPairing } from '../lib/pairing.js'
import { SchemaDriftState } from '../components/SchemaDriftState.js'
import { DaemonUnreachableState } from '../components/DaemonUnreachableState.js'

export const Route = createLazyRoute('/pair')({
  component: PairFlow,
})

const routeApi = getRouteApi('/pair')

type Status =
  | { kind: 'pairing' }
  | { kind: 'drift'; drift: DriftIssue }
  | { kind: 'unreachable'; agentUrl: string }
  | { kind: 'failed'; heading: string; body: string }

export function PairFlow() {
  const { agent, token } = routeApi.useSearch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>({ kind: 'pairing' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPairing({ agentUrl: agent, token, pairedAt: new Date().toISOString() })
      try {
        const result = await apiFetch('/health', HealthResponseSchema)
        if (cancelled) return
        if (!result.ok) {
          clearPairing()
          setStatus({ kind: 'drift', drift: result.drift })
          return
        }
        if (!result.data.ok) {
          clearPairing()
          setStatus({
            kind: 'failed',
            heading: 'Pairing failed',
            body: 'The agent reported it is not ready. Try `agentic-dashboard status` in your terminal.',
          })
          return
        }
        // Happy path — credentials retained, navigate to home.
        void navigate({ to: '/', replace: true })
      } catch (err) {
        if (cancelled) return
        clearPairing()
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setStatus({
              kind: 'failed',
              heading: 'Token rejected',
              body: "Re-check the token in the agent's startup banner.",
            })
          } else {
            setStatus({
              kind: 'failed',
              heading: 'Pairing failed',
              body: `HTTP ${err.status}. Try the manual-pair flow on /settings.`,
            })
          }
        } else {
          // TypeError("Failed to fetch") — daemon down.
          setStatus({ kind: 'unreachable', agentUrl: agent })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agent, token, navigate])

  useEffect(() => {
    document.title = 'AgenticApps Dashboard — Pair'
  }, [])

  if (status.kind === 'pairing') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
        <header>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-text-primary">
            Pairing in progress
          </h1>
          <p className="mt-2 max-w-[75ch] text-base leading-relaxed text-text-secondary">
            Hold tight while the dashboard contacts the agent.
          </p>
        </header>
        <ol className="mx-auto mt-8 max-w-[60ch] list-decimal space-y-3 pl-6 text-base leading-relaxed text-text-primary">
          <li className="max-w-[75ch]">Open the printed pair URL in this browser.</li>
          <li className="max-w-[75ch]">Approve the pairing in your terminal.</li>
          <li className="max-w-[75ch]">Wait for the dashboard to populate.</li>
        </ol>
        <p
          role="status"
          aria-live="polite"
          className="mt-8 text-sm text-text-secondary"
        >
          Connecting to agent&hellip;
        </p>
      </div>
    )
  }

  if (status.kind === 'drift') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
        <SchemaDriftState
          firstIssue={{
            path: status.drift.path,
            expected: status.drift.expected,
            got: status.drift.got,
          }}
          fullIssues={status.drift.issues}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (status.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
        <DaemonUnreachableState
          agentUrl={status.agentUrl}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  // status.kind === 'failed'
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
      <section role="status" className="rounded-md border border-border-subtle bg-card-bg p-6">
        <h2 className="text-xl font-semibold leading-snug text-text-primary">{status.heading}</h2>
        <p className="mt-3 max-w-[75ch] text-base leading-relaxed text-text-secondary">{status.body}</p>
      </section>
    </div>
  )
}
