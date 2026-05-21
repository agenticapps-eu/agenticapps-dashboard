/**
 * FleetTrendChart — pure-SVG 90-day fleet conformance trend (Plan 12-03).
 * D-12-08 (no chart library), D-12-09 (90d window), D-12-10 (heavy fleet stroke),
 * D-12-11 (hover+focus+touch+keyboard reveal), D-12-12 (gridlines + 70/90 rules),
 * D-12-13 (building/empty states). Pitfalls 4/5/8 mitigated.
 * T-12-XSS: text rendered via JSX escaping; no dangerous-inner-html prop.
 *
 * F12 (Adversarial, confidence 7/10): keyboard nav is ONE tab stop — the
 * SVG itself — with arrow keys driving a cursor through the days. The
 * previous shape ran 90 tabIndex=0 rects which produced 90 sequential
 * tab stops AND a mouse/keyboard state-machine bug (tab-focusing one cell
 * + mouse-hovering another would overwrite the panel). Now hover and
 * cursor are tracked separately; hover wins when active, otherwise the
 * keyboard cursor drives the panel.
 */
import { useState, type KeyboardEvent, type ReactElement } from 'react'
import type { ConformanceDayPoint } from '@agenticapps/dashboard-shared'

interface Props {
  series: ConformanceDayPoint[]
  ariaLabel: string
}

const W = 720, H = 240, PAD = { top: 20, right: 16, bottom: 32, left: 36 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const MIN_DAYS = 14
const FAMILY_KEYS = ['agenticapps', 'factiv', 'neuroflash'] as const
const FAMILY_STROKES: Record<(typeof FAMILY_KEYS)[number], string> = {
  agenticapps: 'stroke-status-info',
  factiv: 'stroke-status-warning',
  neuroflash: 'stroke-accent',
}

export function FleetTrendChart({ series, ariaLabel }: Props): ReactElement {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)
  const n = series.length

  if (n === 0) {
    return <div className="text-text-tertiary text-sm">No history yet — building 90-day trend.</div>
  }
  if (n < MIN_DAYS) {
    return (
      <div className="text-text-tertiary text-sm">
        Building 90-day trend — {MIN_DAYS - n} more day(s) of data needed.
      </div>
    )
  }

  const x = (i: number): number => PAD.left + (i / Math.max(1, n - 1)) * PLOT_W
  const y = (score: number): number => PAD.top + (1 - score / 100) * PLOT_H
  const polyline = (key: 'fleet' | (typeof FAMILY_KEYS)[number]): string =>
    series.map((d, i) => `${x(i)},${y(d[key])}`).join(' ')
  // Panel target: hover (mouse) wins over cursor (keyboard) so a mouse user
  // never sees the panel jump when the keyboard cursor moves elsewhere.
  const activeIdx = hoverIdx ?? cursorIdx
  const onSvgKeyDown = (e: KeyboardEvent<SVGSVGElement>): void => {
    if (e.key === 'Escape') { setCursorIdx(null); return }
    const cur = cursorIdx ?? n - 1
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Enter' || e.key === ' ') next = cur
    if (next !== null) { e.preventDefault(); setCursorIdx(next) }
  }

  return (
    <div role="img" aria-label={ariaLabel} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto outline-none"
           tabIndex={0} role="application" aria-label={ariaLabel}
           onKeyDown={onSvgKeyDown} onBlur={() => setCursorIdx(null)}>
        {[0, 25, 50, 75, 100].map((v) => {
          const isThreshold = v === 70 || v === 90
          return (
            <line
              key={v}
              x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
              className={isThreshold ? 'stroke-border-subtle' : 'stroke-border-subtle/50'}
              {...(isThreshold ? { strokeDasharray: '4 4' } : {})}
            />
          )
        })}
        {/* Explicit 70 + 90 threshold rules (dashed) on top of base gridlines. */}
        {[70, 90].map((v) => (
          <line key={`th-${v}`} x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
                className="stroke-border-subtle" strokeDasharray="4 4" />
        ))}
        {FAMILY_KEYS.map((fam) => (
          <polyline key={fam} points={polyline(fam)} fill="none"
                    className={FAMILY_STROKES[fam]} strokeWidth={1.5} />
        ))}
        <polyline points={polyline('fleet')} fill="none"
                  className="stroke-text-primary" strokeWidth={2.5} />
        {series.map((d, i) => (
          <g key={d.date}>
            <line x1={x(i)} y1={H - PAD.bottom} x2={x(i)} y2={H - PAD.bottom + 4}
                  className="stroke-text-tertiary" />
            {(n - 1 - i) % 14 === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10}
                    className="fill-text-tertiary">{d.date.slice(5)}</text>
            )}
            {/* Mouse + touch hit targets. tabIndex={-1} so the chart has
                ONE tab stop (the SVG itself); arrow keys drive cursorIdx. */}
            <rect x={x(i) - PLOT_W / (n * 2)} y={PAD.top} width={PLOT_W / n} height={PLOT_H}
                  fill="transparent" tabIndex={-1}
                  aria-label={`${d.date} — fleet ${d.fleet}%`}
                  onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                  onPointerDown={() => setHoverIdx(i)} />
          </g>
        ))}
        {/* Keyboard-cursor indicator — only when keyboard cursor active and
            mouse is not hovering. Vertical line through the active day. */}
        {hoverIdx === null && cursorIdx !== null && series[cursorIdx] && (
          <line x1={x(cursorIdx)} y1={PAD.top} x2={x(cursorIdx)} y2={H - PAD.bottom}
                className="stroke-accent" strokeWidth={1.5} aria-hidden="true" />
        )}
        {[0, 50, 100].map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10}
                className="fill-text-tertiary">{v}</text>
        ))}
      </svg>
      {activeIdx !== null && series[activeIdx] && (
        <div className="absolute top-0 right-0 bg-card-bg border border-border-subtle rounded-md p-3 shadow-card text-sm z-[var(--z-overlay)]">
          <div className="font-semibold">{series[activeIdx]!.date}</div>
          <div>Fleet: <strong>{series[activeIdx]!.fleet}%</strong></div>
          <div>agenticapps: {series[activeIdx]!.agenticapps}%</div>
          <div>factiv: {series[activeIdx]!.factiv}%</div>
          <div>neuroflash: {series[activeIdx]!.neuroflash}%</div>
        </div>
      )}
      <table className="sr-only">
        <caption>Daily fleet conformance scores (last {n} days)</caption>
        <thead><tr><th>Date</th><th>Fleet</th><th>agenticapps</th><th>factiv</th><th>neuroflash</th></tr></thead>
        <tbody>{series.map((d) => (
          <tr key={d.date}><td>{d.date}</td><td>{d.fleet}</td><td>{d.agenticapps}</td><td>{d.factiv}</td><td>{d.neuroflash}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
