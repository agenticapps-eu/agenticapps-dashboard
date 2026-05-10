import { useRef } from 'react'
import { MoreVertical, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { RegistryListItem } from '@agenticapps/dashboard-shared'

import { useProjectOverview } from '../lib/registry.js'
import { useLongPress } from '../lib/touchLongPress.js'

import { SchemaDriftState } from './SchemaDriftState.js'

export interface ProjectCardProps {
  item: RegistryListItem
  onContextMenu: (
    anchor: { type: 'pointer'; x: number; y: number } | { type: 'element'; el: HTMLElement },
    item: RegistryListItem,
  ) => void
}

/**
 * Extracts leading digits from a phase dir name.
 * e.g. "03-multi-project-home" => "03"
 */
function extractPhaseNum(phase: string | null): string {
  if (!phase) return '—'
  const match = /^(\d+)/.exec(phase)
  return match ? (match[1] ?? phase) : phase
}

/**
 * Returns a human-readable relative time string.
 */
function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * Single glyph group: emoji + count in fixed-width inline-flex.
 */
function GlyphGroup({
  glyph,
  count,
}: {
  glyph: string
  count: number
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 w-12">
      <span aria-hidden="true">{glyph}</span>
      {count}
    </span>
  )
}

/**
 * Finding row with colored Unicode glyphs.
 */
function FindingRow({
  label,
  red,
  yellow,
  green,
}: {
  label: string
  red: number
  yellow: number
  green: number
}): React.JSX.Element {
  const ariaLabel = `${red} critical, ${yellow} medium, ${green} low`
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-secondary font-semibold">{label}</span>
      <span
        aria-label={ariaLabel}
        className="inline-flex items-center gap-2 font-mono text-text-primary"
      >
        <GlyphGroup glyph="🔴" count={red} />
        <GlyphGroup glyph="🟡" count={yellow} />
        <GlyphGroup glyph="🟢" count={green} />
      </span>
    </div>
  )
}

export function ProjectCard({ item, onContextMenu }: ProjectCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)
  const unreachable = item.status.reachable === false

  const overview = useProjectOverview(unreachable ? null : item.id)

  const isDrift =
    overview.isError && overview.error?.message?.startsWith('schema_drift:')
  const isError = overview.isError && !isDrift
  const isLoading = overview.isLoading

  const longPress = useLongPress(() => {
    onContextMenu({ type: 'element', el: cardRef.current! }, item)
  })

  function handleCardClick() {
    navigate({ to: '/projects/$projectId', params: { projectId: item.id } })
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu({ type: 'pointer', x: e.clientX, y: e.clientY }, item)
  }

  const containerClass = [
    'group relative flex flex-col gap-2 bg-card-bg border border-border-subtle rounded-card p-4 text-left w-full shadow-card',
    'hover:bg-card-bg-hover hover:border-border-subtle',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
    'transition-colors duration-100 ease-out',
    unreachable ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      // Activate the card unless the keypress targets a nested interactive element.
      if (e.target === e.currentTarget) {
        e.preventDefault()
        handleCardClick()
      }
    }
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      className={containerClass}
      aria-label={`View ${item.name}`}
      aria-busy={isLoading ? 'true' : undefined}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      {...longPress}
    >
      {/* Kebab button — always visible, always in tab order */}
      <button
        type="button"
        data-kebab
        aria-label={`Project options for ${item.name}`}
        aria-haspopup="menu"
        className="absolute top-3 right-3 h-8 w-8 p-2 text-text-secondary rounded-md hover:bg-card-bg-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent z-10"
        onClick={(e) => {
          e.stopPropagation()
          onContextMenu({ type: 'element', el: e.currentTarget }, item)
        }}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {/* Card name (Heading — 20px/600) */}
      <span className="text-xl font-semibold leading-snug text-text-primary pr-8">{item.name}</span>

      {/* Subtitle: client · tags */}
      <span className="text-sm text-text-secondary">
        {[item.client, ...item.tags].filter(Boolean).join(' · ')}
      </span>

      {/* Drift state: replaces card body */}
      {isDrift && overview.error ? (
        <SchemaDriftState
          firstIssue={{ path: '(root)', expected: 'ProjectOverview', got: 'unknown' }}
          fullIssues={[]}
          onRetry={() => overview.refetch()}
        />
      ) : null}

      {/* Unreachable state */}
      {unreachable && !isDrift ? (
        <>
          <span className="text-status-error text-sm font-mono">
            unreachable: {item.root}
          </span>
          <button
            type="button"
            aria-label={`Unregister ${item.name}`}
            className="text-status-error text-sm underline self-start"
            onClick={(e) => {
              e.stopPropagation()
              const kebab = cardRef.current?.querySelector<HTMLElement>('button[data-kebab]')
              if (kebab) onContextMenu({ type: 'element', el: kebab }, item)
            }}
          >
            Unregister?
          </button>
        </>
      ) : null}

      {/* Phase + data lines (non-unreachable, non-drift) */}
      {!unreachable && !isDrift ? (
        <>
          {item.status.currentPhase === null ? (
            <span className="block max-w-[60ch] text-sm">
              <span className="text-text-secondary">no .planning/</span>
              {' '}
              <a
                href="https://github.com/agenticapps/workflow"
                className="text-accent text-sm underline"
                onClick={(e) => e.stopPropagation()}
              >
                install workflow skill &rarr;
              </a>
            </span>
          ) : isLoading ? (
            <span className="text-text-secondary text-sm">—</span>
          ) : isError ? null : overview.data ? (
            <span className="text-sm font-semibold text-text-primary">
              Phase {extractPhaseNum(item.status.currentPhase)} · {overview.data.phaseStatus}
            </span>
          ) : null}

          {/* Stage 2 finding row (compact, visible when data available) */}
          {!isLoading && !isError && overview.data?.stage2?.ran ? (
            <FindingRow
              label="Stage 2:"
              red={overview.data.stage2.findings.red}
              yellow={overview.data.stage2.findings.yellow}
              green={overview.data.stage2.findings.green}
            />
          ) : null}

          {/* Expanded section — hover/focus reveals additional rows */}
          <div
            className="overflow-hidden max-h-0 opacity-0 motion-safe:transition-[max-height,opacity] motion-safe:duration-120 ease-out group-hover:max-h-[200px] group-hover:opacity-100 group-focus-within:max-h-[200px] group-focus-within:opacity-100"
          >
            {!isLoading && !isError && overview.data ? (
              <div className="flex flex-col gap-2 pt-2">
                {/* Stage 1 row (expanded only) */}
                {overview.data.stage1?.ran ? (
                  <FindingRow
                    label="Stage 1:"
                    red={overview.data.stage1.findings.red}
                    yellow={overview.data.stage1.findings.yellow}
                    green={overview.data.stage1.findings.green}
                  />
                ) : null}

                {/* DB-AUDIT row (expanded only) */}
                {overview.data.dbAudit ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-secondary font-semibold">DB-AUDIT:</span>
                    <span className="text-text-primary">
                      {overview.data.dbAudit.findings.critical} critical
                      {' · '}
                      {overview.data.dbAudit.findings.high} high
                      {' · '}
                      {overview.data.dbAudit.findings.medium} medium
                      {' · '}
                      {overview.data.dbAudit.findings.low} low
                    </span>
                  </div>
                ) : null}

                {/* TDD pairs row (expanded only) */}
                {overview.data.tdd ? (
                  <div className="text-sm">
                    <span className="text-text-secondary font-semibold">TDD pairs: </span>
                    <span className="text-text-primary">
                      {overview.data.tdd.greenPairs}/{overview.data.tdd.totalTasks}
                    </span>
                  </div>
                ) : null}

                {/* Verification row (expanded only) */}
                {overview.data.verification ? (
                  <div className="text-sm">
                    <span className="text-text-secondary font-semibold">Verification: </span>
                    <span className="text-text-primary">
                      {overview.data.verification.evidence}/{overview.data.verification.mustHaves}
                    </span>
                  </div>
                ) : null}

                {/* Branch row (expanded only) */}
                {overview.data.branch ? (
                  <div className="text-sm">
                    <span className="text-text-secondary font-semibold">Branch: </span>
                    <span className="text-text-primary font-mono">{overview.data.branch}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Footer: last commit OR error footer */}
          {isError ? (
            <div role="status" className="flex items-center gap-1 text-sm text-text-secondary">
              <AlertTriangle size={12} aria-hidden="true" className="text-status-warning" />
              overview unavailable · retrying
            </div>
          ) : (
            <span className="text-sm text-text-secondary">
              last commit {relativeTime(item.status.lastCommitAt)}
            </span>
          )}
        </>
      ) : null}
    </div>
  )
}
