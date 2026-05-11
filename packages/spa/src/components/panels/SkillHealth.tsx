/**
 * SkillHealth — HEALTH-02 panel.
 *
 * Renders AgentLinter results with row-level click-to-expand (D-5-16) and
 * 4 explicit failure-class states (D-5-15): not-installed, timeout, error, unparseable.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4. kind:'not-installed' → CodeBlock install hint
 *   5. kind:'timeout' → timeout copy + Retry scan button (44×44 touch target)
 *   6. kind:'error' → stderr <pre> + exit code label
 *   7. kind:'unparseable' → unparseable copy with exit code
 *   8. kind:'ok' → score badge + per-file rows with row-level expand (D-5-16)
 *
 * Severity glyph mapping (UI-SPEC line 238 — 3 of D-4-16's 4 glyphs):
 *   error → 🔴, warning → 🟠, info → ⚪. 🟡 unused (AgentLinter emits 3 severities only).
 *
 * Threat mitigations:
 *   T-05-04-Schema-Drift: error.message.startsWith('schema_drift:') → InlineDrift.
 *   T-05-04-Markdown-Injection: all daemon strings rendered as React text children.
 *   T-05-04-Cache-Bypass-Privacy: retry calls /api/projects/:id/agentlinter?bypassCache=1
 *     which still runs with --local; bypass is to the cache, not the privacy flag.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React, { useState, useId } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AgentLinterResponseSchema } from '@agenticapps/dashboard-shared'
import type { AgentLinterResponse } from '@agenticapps/dashboard-shared'

import { useAgentLinter } from '../../lib/projectQueries.js'
import { apiFetch } from '../../lib/api.js'
import { CodeBlock } from '../CodeBlock.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type SkillHealthProps = { projectId: string }

const PANEL_ID = 'skill-health'
const PANEL_TITLE = 'Skill Health'

const GLYPH = { error: '🔴', warning: '🟠', info: '⚪' } as const

export function SkillHealth({ projectId }: SkillHealthProps): React.JSX.Element {
  const query = useAgentLinter(projectId)
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const detailRegionPrefix = useId()

  // Schema drift
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

  const data: AgentLinterResponse = query.data

  // kind: 'not-installed' — bundled @agenticapps/agentlinter dep failed to resolve.
  // Should be unreachable in normal installs (D-5-21); fires only on broken
  // node_modules or a partial pnpm install. Recovery is to reinstall the daemon.
  if (data.kind === 'not-installed') {
    // D-6.1-02: collapse by default in empty/error state; D-6.1-01: cap prose at 75ch
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} defaultCollapsed>
        <p className="max-w-[75ch] text-sm text-text-primary">
          AgentLinter binary missing from the daemon install. Reinstall with
        </p>
        <CodeBlock command="pnpm install --frozen-lockfile" copyLabel="Copy reinstall command" />
        <p className="max-w-[75ch] text-sm text-text-primary">to restore scoring.</p>
      </PanelContainer>
    )
  }

  // kind: 'timeout'
  if (data.kind === 'timeout') {
    const onRetry = async () => {
      const result = await apiFetch(
        `/api/projects/${projectId}/agentlinter?bypassCache=1`,
        AgentLinterResponseSchema,
      )
      if (result.ok) {
        queryClient.setQueryData(['agentlinter', projectId], result.data)
      }
    }
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-primary">Lint scan timed out after 30 seconds.</p>
        <button
          type="button"
          onClick={() => void onRetry()}
          aria-label="Retry agentlinter scan, bypassing cache"
          className="mt-2 rounded border border-border-subtle px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent min-w-[44px] min-h-[44px]"
        >
          Retry scan
        </button>
      </PanelContainer>
    )
  }

  // kind: 'error'
  if (data.kind === 'error') {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-primary">Lint scan failed.</p>
        <pre className="whitespace-pre-wrap rounded bg-card-bg-hover p-3 font-mono text-xs text-text-secondary">
          {data.stderr}
        </pre>
        <p className="mt-2 font-mono text-xs text-text-tertiary">Exit code: {data.exitCode}</p>
      </PanelContainer>
    )
  }

  // kind: 'unparseable'
  if (data.kind === 'unparseable') {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-primary">
          Lint scan failed (exit {data.exitCode}) — see daemon log.
        </p>
      </PanelContainer>
    )
  }

  // kind: 'ok' — happy path
  const { report } = data
  const scoreColor =
    report.score >= 90
      ? 'text-status-success'
      : report.score < 60
        ? 'text-status-warning'
        : 'text-text-primary'

  // Collect unique file names from report.files + diagnostic file references
  const fileNames = [
    ...new Set([...report.files, ...report.diagnostics.map((d) => d.file)]),
  ].sort()

  const toggle = (fileName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(fileName)) {
        next.delete(fileName)
      } else {
        next.add(fileName)
      }
      return next
    })
  }

  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
      <div className={`mb-3 font-mono text-sm tabular-nums ${scoreColor}`}>{report.score}/100</div>
      <ul className="divide-y divide-border-subtle">
        {fileNames.map((file) => {
          const diagnostics = report.diagnostics.filter((d) => d.file === file)
          const counts = { error: 0, warning: 0, info: 0 }
          for (const d of diagnostics) {
            counts[d.severity]++
          }
          const isOpen = expanded.has(file)
          // Sanitize file name for use in DOM id (replace non-alphanumeric with -)
          const safeFile = file.replaceAll(/[^A-Za-z0-9]/g, '-')
          const detailRegionId = `${detailRegionPrefix}-${safeFile}`

          return (
            <li key={file}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={detailRegionId}
                aria-label={`${file}, click to ${isOpen ? 'collapse' : 'expand'} details`}
                onClick={() => toggle(file)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && isOpen) toggle(file)
                }}
                className="w-full flex items-center gap-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="font-mono text-sm text-text-primary flex-1">{file}</span>
                <span className="font-mono text-xs tabular-nums text-text-secondary">
                  {diagnostics.length} findings
                </span>
                {diagnostics.length > 0 && (
                  <span
                    aria-label={`${counts.error} error, ${counts.warning} warning, ${counts.info} info`}
                    className="inline-flex items-center gap-1"
                  >
                    {counts.error > 0 && (
                      <span aria-hidden="true" className="font-mono text-xs">
                        {GLYPH.error} {counts.error}
                      </span>
                    )}
                    {counts.warning > 0 && (
                      <span aria-hidden="true" className="font-mono text-xs">
                        {GLYPH.warning} {counts.warning}
                      </span>
                    )}
                    {counts.info > 0 && (
                      <span aria-hidden="true" className="font-mono text-xs">
                        {GLYPH.info} {counts.info}
                      </span>
                    )}
                  </span>
                )}
              </button>
              {isOpen && (
                <div
                  role="region"
                  id={detailRegionId}
                  className="mt-2 rounded bg-card-bg-hover p-3 flex flex-col gap-2"
                >
                  {diagnostics.map((d, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-sm">
                      <span aria-hidden="true">{GLYPH[d.severity]}</span>
                      <span className="font-mono text-xs text-text-secondary">[{d.rule}]</span>
                      <span className="text-sm text-text-primary">{d.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </PanelContainer>
  )
}
