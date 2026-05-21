/**
 * FamilyCard — per-family conformance card (Plan 12-03 / D-12-04, D-12-06).
 *
 * Renders: family name + score (0-100 integer) + baseline-window delta with
 * up/down glyph + tier pill colored via `tierOf` from @agenticapps/dashboard-shared
 * (single source of truth for the D-12-04 90/70 threshold mapping).
 *
 * F14: prop is `delta` (signed score-point delta vs the baseline window)
 * plus `baselineDays` (window size in days). Decouples from the literal
 * 14-day window so future 30d/60d toggles change the value, not the shape.
 *
 * Token namespace: Phase 5.1 status tokens (text-status-success | -warning |
 * -error). No hex literals — enforced by F9 + the global
 * tokenSourceOfTruth.test.ts invariant.
 *
 * T-12-XSS: text rendered via JSX escaping; no dangerous inner-html prop.
 */
import type { ReactElement } from 'react'
import { tierOf, type ConformanceTier } from '@agenticapps/dashboard-shared'

export interface FamilyCardProps {
  family: 'agenticapps' | 'factiv' | 'neuroflash'
  score: number
  delta: number
  baselineDays: number
}

function tierClasses(tier: ConformanceTier): string {
  switch (tier) {
    case 'green':
      return 'bg-status-success/10 text-status-success border-status-success/30'
    case 'amber':
      return 'bg-status-warning/10 text-status-warning border-status-warning/30'
    case 'red':
      return 'bg-status-error/10 text-status-error border-status-error/30'
  }
}

function deltaGlyph(d: number): { glyph: string; cls: string; label: string; n: number } {
  if (d > 0) return { glyph: '▲', cls: 'text-status-success', label: `Up ${d} points`, n: d }
  if (d < 0) return { glyph: '▼', cls: 'text-status-error', label: `Down ${Math.abs(d)} points`, n: Math.abs(d) }
  return { glyph: '—', cls: 'text-text-tertiary', label: 'No change', n: 0 }
}

export function FamilyCard({ family, score, delta, baselineDays }: FamilyCardProps): ReactElement {
  const tier = tierOf(score)
  const pillCls = tierClasses(tier)
  const { glyph, cls: deltaCls, label: deltaLabel, n: deltaN } = deltaGlyph(delta)

  return (
    <article className="rounded-lg border border-border-subtle bg-card-bg p-4 flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary capitalize">{family}</h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${pillCls}`}
          aria-label={`Tier ${tier}`}
        >
          {tier}
        </span>
      </header>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold text-text-primary tabular-nums">{score}</span>
        <span className={`text-sm font-semibold ${deltaCls}`} aria-label={deltaLabel}>
          {delta === 0 ? <span>{glyph}</span> : <>{glyph} {deltaN}</>}
        </span>
      </div>
      <div className="text-xs text-text-tertiary">{baselineDays}d trend</div>
    </article>
  )
}
