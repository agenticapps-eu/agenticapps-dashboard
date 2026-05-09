/**
 * IntegrationsHealth — HEALTH-05 panel.
 *
 * Renders 3-state per-integration rows: Sentry / Linear / Infisical.
 * D-5-19: configured / present-but-not-configured / not-detected.
 * D-5-20: inline one-paragraph guides for not-detected state — NO external links.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4. Happy path → 3-row grid; each row shows pill + optional nudge/paragraph
 *
 * Per-row rendering:
 *   configured              → pill 'configured' (success-colored) only
 *   present-but-not-configured → pill 'set up needed' (warning) + env-var nudge
 *   not-detected            → pill 'not detected' (muted) + inline one-paragraph guide
 *
 * Threat mitigations:
 *   T-05-05-Cross-Project-Cache: useIntegrations(projectId) includes projectId in key.
 *   T-05-05-Static-Copy-Trust: paragraphs are React JSX literals — no daemon content interpolated.
 *   T-05-05-No-Read-More-Link: no <a href> anchors; D-5-20 inline copy IS the documentation.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { useIntegrations } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type IntegrationsHealthProps = { projectId: string }

const PANEL_ID = 'integrations-health'
const PANEL_TITLE = 'Integrations'

// Per-integration metadata: label, env-var nudge, and not-detected paragraph.
// All copy verbatim per UI-SPEC §Copywriting lines 420–427 (D-5-20).
// Stored as React JSX literals — no daemon content interpolated (T-05-05-Static-Copy-Trust).
const INTEGRATIONS = [
  {
    key: 'sentry' as const,
    label: 'Sentry',
    nudge: (
      <>
        Sentry SDK detected. Set{' '}
        <code className="font-mono">SENTRY_AUTH_TOKEN</code> to enable the panel.
      </>
    ),
    paragraph: (
      <>
        Sentry surfaces recent errors and unhandled rejections inline. Install{' '}
        <code className="font-mono">@sentry/node</code> (or your framework SDK), set{' '}
        <code className="font-mono">SENTRY_AUTH_TOKEN</code> on the daemon, and restart.
        Recent errors appear in the right column without code changes here.
      </>
    ),
  },
  {
    key: 'linear' as const,
    label: 'Linear',
    nudge: (
      <>
        Linear branch references detected. Set{' '}
        <code className="font-mono">LINEAR_API_KEY</code> to enable the panel.
      </>
    ),
    paragraph: (
      <>
        Linear links commits and PRs to issue IDs. Set{' '}
        <code className="font-mono">LINEAR_API_KEY</code> on the daemon and use a branch name like{' '}
        <code className="font-mono">donald/abc-123-fix-foo</code> — issue title and status surface
        in the project header.
      </>
    ),
  },
  {
    key: 'infisical' as const,
    label: 'Infisical',
    nudge: (
      <>
        <code className="font-mono">.infisical.json</code> detected. Run the daemon under{' '}
        <code className="font-mono">infisical run</code> to load secrets.
      </>
    ),
    paragraph: (
      <>
        Infisical loads secrets from a Universal Auth project at runtime. Run{' '}
        <code className="font-mono">infisical run --env=prod -- agentic-dashboard start</code> and
        the daemon reads its env from Infisical. No env var lives inside the dashboard.
      </>
    ),
  },
] as const

const PILL_LABEL = {
  configured: 'configured',
  'present-but-not-configured': 'set up needed',
  'not-detected': 'not detected',
} as const

const PILL_CLASS = {
  configured: 'text-status-success',
  'present-but-not-configured': 'text-status-warning',
  'not-detected': 'text-text-secondary',
} as const

export function IntegrationsHealth({ projectId }: IntegrationsHealthProps): React.JSX.Element {
  const query = useIntegrations(projectId)

  // Schema drift: surface inline
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

  // Loading
  if (query.isLoading) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  // Non-drift error or missing data → unreachable
  if (query.error || !query.data) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  const data = query.data

  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        {INTEGRATIONS.map(({ key, label, nudge, paragraph }) => {
          const state = data[key]
          const pillLabel = PILL_LABEL[state]
          const pillClass = PILL_CLASS[state]
          return (
            <React.Fragment key={key}>
              <span className="text-sm font-semibold text-text-primary">{label}</span>
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-flex items-center self-start rounded bg-card-bg-hover px-1.5 py-0.5 text-xs uppercase tracking-wide ${pillClass}`}
                >
                  {pillLabel}
                </span>
                {state === 'present-but-not-configured' && (
                  <span className="text-sm text-text-secondary">{nudge}</span>
                )}
                {state === 'not-detected' && (
                  <span className="text-base leading-relaxed text-text-secondary">{paragraph}</span>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </PanelContainer>
  )
}
