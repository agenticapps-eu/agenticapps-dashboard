/**
 * Presentational sub-parts of FleetTrendChart, split out so the chart file
 * stays within its hand-rolled-SVG LOC budget (D-12-08) while carrying both
 * the persistent legend + labeled thresholds (Phase 12.1 P1) and the
 * single-tab-stop keyboard-nav rewrite (F12). These are pure render helpers;
 * all interaction state lives in FleetTrendChart.
 */
import type { ReactElement } from 'react'
import type { ConformanceDayPoint } from '@agenticapps/dashboard-shared'

// Persistent legend (Phase 12.1 P1): family/fleet → swatch token, parity with strokes.
const LEGEND = [
  ['agenticapps', 'bg-status-info'],
  ['factiv', 'bg-status-warning'],
  ['neuroflash', 'bg-accent'],
  ['fleet', 'bg-text-primary'],
] as const

export function FleetTrendLegend(): ReactElement {
  return (
    <ul
      aria-label="Chart legend"
      className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-text-secondary"
    >
      {LEGEND.map(([label, swatch]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block w-3 h-[3px] rounded-full ${swatch}`} />
          {label}
        </li>
      ))}
    </ul>
  )
}

export function FleetTrendTooltip({
  series,
  activeIdx,
}: {
  series: ConformanceDayPoint[]
  activeIdx: number | null
}): ReactElement | null {
  if (activeIdx === null || !series[activeIdx]) return null
  const d = series[activeIdx]!
  return (
    <div className="absolute top-0 right-0 bg-card-bg border border-border-subtle rounded-md p-3 shadow-card text-sm z-[var(--z-overlay)]">
      <div className="font-semibold">{d.date}</div>
      <div>
        Fleet: <strong>{d.fleet}%</strong>
      </div>
      <div>agenticapps: {d.agenticapps}%</div>
      <div>factiv: {d.factiv}%</div>
      <div>neuroflash: {d.neuroflash}%</div>
    </div>
  )
}

export function FleetTrendDataTable({
  series,
  n,
}: {
  series: ConformanceDayPoint[]
  n: number
}): ReactElement {
  return (
    <table className="sr-only">
      <caption>Daily fleet conformance scores (last {n} days)</caption>
      <thead>
        <tr>
          <th>Date</th>
          <th>Fleet</th>
          <th>agenticapps</th>
          <th>factiv</th>
          <th>neuroflash</th>
        </tr>
      </thead>
      <tbody>
        {series.map((d) => (
          <tr key={d.date}>
            <td>{d.date}</td>
            <td>{d.fleet}</td>
            <td>{d.agenticapps}</td>
            <td>{d.factiv}</td>
            <td>{d.neuroflash}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
