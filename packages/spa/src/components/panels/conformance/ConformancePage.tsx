/**
 * ConformancePage — top-level /observability/conformance page (Plan 12-04 / D-12-01).
 *
 * Composes the Wave 3 primitives behind the useConformance() query:
 *   sticky <PageHeader> → optional <PathDriftPanel> → 3× <FamilyCard> → <FleetTrendChart>
 *
 * Branches (mirrors CoveragePage.tsx pattern — INV-04):
 *   - useConformance error startsWith 'schema_drift:'  → <SchemaDriftState/>
 *   - isPending                                         → loading skeleton
 *   - isError (non-drift)                               → generic error (no FS path leak)
 *   - happy path                                        → composed layout
 *
 * Security:
 *   - T-12-PAGE-ERROR-LEAK — generic "Could not load conformance data." message;
 *     error.message and error.stack NEVER rendered.
 *   - T-12-PAGE-DRIFT-RENDER — schema_drift errors route to <SchemaDriftState/>;
 *     raw drift body is never rendered as if valid.
 *   - T-12-XSS — text rendered via JSX expression interpolation; no
 *     dangerously-set-inner-html prop.
 *
 * Pure composition: no own data fetching, no own state. Each child owns its
 * own state surface (FleetTrendChart hover, PathDriftPanel expand/in-flight).
 *
 * Constraints (D-5.1-10):
 *   - NO cn()/clsx/CVA
 *   - NO hex literals
 */
import type { ReactElement } from 'react'

import { useConformance } from '../../../lib/conformanceQueries.js'
import { PageHeader } from '../../ui/PageHeader.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'

import { FamilyCard } from './FamilyCard.js'
import { FleetTrendChart } from './FleetTrendChart.js'
import { PathDriftPanel } from './PathDriftPanel.js'

const FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const

const PAGE_TITLE = 'Fleet conformance'
const PAGE_HELPER =
  'How conformant every registered project is to the AgenticApps standard.'

/**
 * LoadingSkeleton — placeholder grid mirroring the composed layout shape so the
 * page does not jump on load. 3 family-card-sized cards + 240px chart skeleton.
 * Each block carries an aria-label so the P1 test can detect it without coupling
 * to internal classNames.
 */
function LoadingSkeleton(): ReactElement {
  return (
    <>
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        aria-label="Loading family conformance cards"
      >
        {FAMILIES.map((fam) => (
          <div
            key={fam}
            className="h-28 animate-pulse rounded-lg border border-border-subtle bg-card-bg"
            aria-label={`Loading ${fam} card`}
          />
        ))}
      </div>
      <div
        className="h-60 animate-pulse rounded-lg border border-border-subtle bg-card-bg"
        aria-label="Loading fleet trend chart"
      />
    </>
  )
}

/**
 * ErrorState — generic, non-leaky error surface. The retry button calls the
 * caller-supplied refetch handler. The displayed copy is deliberately fixed
 * (T-12-PAGE-ERROR-LEAK — no `error.message`, no `error.stack`, no anything
 * that could surface a FS path or stack frame to the SPA DOM).
 */
function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <section
      role="status"
      className="rounded-lg border border-border-subtle bg-card-bg p-6"
      aria-label="Conformance data could not be loaded"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        Could not load conformance data.
      </h2>
      <p className="mt-2 text-sm text-text-tertiary">
        Try again — if the issue continues, check that the dashboard agent is
        running on this machine.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Retry
      </button>
    </section>
  )
}

export function ConformancePage(): ReactElement {
  const query = useConformance()

  // Schema-drift branch (T-12-PAGE-DRIFT-RENDER) — same pattern as
  // CoveragePage.tsx:252-260. The query hook throws Error('schema_drift:<path>')
  // when parseOrDrift rejects the daemon response; we route that into the
  // shared SchemaDriftState primitive instead of rendering the raw body.
  if (query.error?.message?.startsWith('schema_drift:')) {
    const path = query.error.message.slice('schema_drift:'.length)
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title={PAGE_TITLE} helper={PAGE_HELPER} sticky={true} />
        <SchemaDriftState
          firstIssue={{ path, expected: 'see schema', got: 'mismatch' }}
          fullIssues={[]}
          onRetry={() => void query.refetch()}
        />
      </main>
    )
  }

  // Loading branch — placeholder skeleton matching the composed layout shape.
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title={PAGE_TITLE} helper={PAGE_HELPER} sticky={true} />
        <LoadingSkeleton />
      </main>
    )
  }

  // Non-drift error branch — generic copy, no FS path leakage.
  if (query.isError) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title={PAGE_TITLE} helper={PAGE_HELPER} sticky={true} />
        <ErrorState onRetry={() => void query.refetch()} />
      </main>
    )
  }

  // Happy path — at this point query.data is guaranteed defined by TanStack
  // Query's discriminated union, but we narrow defensively for the type system.
  const data = query.data
  if (!data) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title={PAGE_TITLE} helper={PAGE_HELPER} sticky={true} />
        <LoadingSkeleton />
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title={PAGE_TITLE} helper={PAGE_HELPER} sticky={true} />

      {/* PathDriftPanel auto-hides when drifted is empty (see PathDriftPanel.tsx),
          but the conditional render here is defence-in-depth and keeps the DOM
          tidy when there is nothing drifted. */}
      {data.drifted.length > 0 && <PathDriftPanel drifted={data.drifted} />}

      <section
        aria-label="Family conformance scores"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {FAMILIES.map((fam) => (
          <FamilyCard
            key={fam}
            family={fam}
            score={data.today[fam]}
            delta14d={data.delta14d[fam]}
          />
        ))}
      </section>

      <section
        aria-labelledby="conformance-trend-heading"
        className="rounded-lg border border-border-subtle bg-card-bg p-4"
      >
        <h2
          id="conformance-trend-heading"
          className="text-base font-semibold text-text-primary mb-2"
        >
          90-day fleet trend
        </h2>
        <p className="text-sm text-text-tertiary mb-4">
          Daily conformance score per family + fleet aggregate.
        </p>
        <FleetTrendChart
          series={data.series}
          ariaLabel="Daily fleet conformance scores over the last 90 days"
        />
      </section>
    </main>
  )
}

export default ConformancePage
