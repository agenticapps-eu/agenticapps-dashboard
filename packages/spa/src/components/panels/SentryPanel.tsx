/**
 * SentryPanel — Phase 8 SENTRY-01/02/03 panel.
 *
 * Renders the daemon-aggregated Sentry recent-issues feed for a single project.
 * 4-state guard block copied verbatim from ObservabilityHealth.tsx.
 *
 * States:
 *   1. schema_drift error → InlineDrift (INV-04 at the browser boundary)
 *   1b. not_configured error (daemon 404 when SENTRY_AUTH_TOKEN unset) → static
 *       configure-to-enable JSX literal (T-05-05-Static-Copy-Trust), defaultCollapsed (INV-03)
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4a. Configured, data.issues.length === 0 → "No recent Sentry issues." (healthy empty state)
 *   4b. Happy path → up to 5 issue rows with title, level badge, event count, lastSeen, link-out
 *
 * Stale handling (SENTRY-02):
 *   When data.stale === true, PanelContainer shows a "Stale" pill and a verbatim banner
 *   "Sentry API unreachable — using cached data from {staleFrom}".
 *
 * Link-out (D-08-04):
 *   Each issue row includes an <a href={permalink} target="_blank" rel="noopener noreferrer">
 *   with shortId as link text and the ExternalLink icon.
 *
 * Threat mitigations:
 *   T-08-24: configure copy is a JSX literal — never interpolated from query.data
 *   T-08-25: only non-secret issue metadata rendered; React auto-escapes
 *   T-08-26: all link-outs use rel="noopener noreferrer" target="_blank"
 *   T-08-27: apiFetch parseOrDrift → schema_drift guard → InlineDrift (INV-04)
 */
import { ExternalLink } from 'lucide-react'
import React from 'react'

import { useSentryRecent } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type SentryPanelProps = { projectId: string }

const PANEL_ID = 'sentry-panel'
const PANEL_TITLE = 'Sentry'

const LEVEL_CLASS: Record<string, string> = {
  fatal: 'text-status-error',
  error: 'text-status-error',
  warning: 'text-status-warning',
  info: 'text-text-secondary',
  debug: 'text-text-tertiary',
}

export function SentryPanel({ projectId }: SentryPanelProps): React.JSX.Element {
  const query = useSentryRecent(projectId)

  // 1. Schema drift: surface inline (copied verbatim from ObservabilityHealth.tsx)
  if (query.error?.message?.startsWith('schema_drift:')) {
    const path = query.error.message.slice('schema_drift:'.length)
    return (
      <InlineDrift
        panelId={PANEL_ID}
        title={PANEL_TITLE}
        path={path}
        onRetry={() => void query.refetch()}
      />
    )
  }

  // 1b. Not configured (daemon 404 not_configured when SENTRY_AUTH_TOKEN is unset)
  // → static configure-to-enable copy (INV-03), NOT the unreachable error state.
  // STATIC JSX literal (T-05-05-Static-Copy-Trust); collapsed by default (D-6.1-02).
  if (query.error?.message === 'not_configured') {
    return (
      // key forces a fresh PanelContainer mount on the loading→not_configured
      // transition so defaultCollapsed actually takes effect (D-6.1-02). Without
      // it, React reuses the loading-state instance whose collapsed state was
      // initialised to false, leaving the configure copy expanded.
      <PanelContainer key="not-configured" panelId={PANEL_ID} title={PANEL_TITLE} defaultCollapsed>
        <p className="max-w-[75ch] text-base leading-relaxed text-text-secondary">
          Set <code className="font-mono">SENTRY_AUTH_TOKEN</code> to enable the Sentry panel.{' '}
          <a href="/help" className="text-accent underline-offset-2 hover:underline">
            Learn more
          </a>
        </p>
      </PanelContainer>
    )
  }

  // 2. Loading (copied verbatim from ObservabilityHealth.tsx)
  if (query.isLoading) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  // 3. Non-drift error or missing data → unreachable (copied verbatim from ObservabilityHealth.tsx)
  if (query.error || !query.data) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  const data = query.data

  // 4a. Configured but no recent issues (daemon returned HTTP 200 with empty list).
  // A calm, healthy signal — distinct from the not-configured state above, which
  // must never tell a user who HAS set SENTRY_AUTH_TOKEN to set it again.
  if (data.issues.length === 0) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-secondary">No recent Sentry issues.</p>
      </PanelContainer>
    )
  }

  // 4b. Happy path: issue list with link-out
  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} stale={data.stale}>
      {data.stale && data.staleFrom && (
        <p className="text-sm text-status-warning">
          Sentry API unreachable — using cached data from {data.staleFrom}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {data.issues.map((issue) => (
          <li key={issue.id} className="flex flex-col gap-1">
            <span className="text-sm text-text-primary">{issue.title}</span>
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span
                className={`font-semibold uppercase tracking-wide ${LEVEL_CLASS[issue.level] ?? 'text-text-secondary'}`}
              >
                {issue.level}
              </span>
              <span>{Number(issue.count).toLocaleString()} events</span>
              <span>{issue.lastSeen}</span>
              {/* CR-01 defense-in-depth: only render as live link when scheme is http(s).
                  The schema already rejects non-http(s) permalinks; this guard handles
                  any future code path that might bypass schema validation. */}
              {/^https?:/i.test(issue.permalink) ? (
                <a
                  href={issue.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
                >
                  {issue.shortId}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-text-secondary">
                  {issue.shortId}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
