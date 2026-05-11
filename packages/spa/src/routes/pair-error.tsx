/**
 * RouteError — generic visible fallback for non-VALIDATE_SEARCH errors that
 * surface on the /pair route via TanStack Router's errorComponent. Replaces
 * the previous `throw error` (WR-02) which would propagate into React render
 * and produce a blank screen because this app has no outer error boundary.
 *
 * Lives in pair-error.tsx so router.tsx can eager-import it without pulling
 * in the pair.lazy chunk.
 */
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error.'
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
      <section
        role="alert"
        className="rounded-md border border-border-subtle bg-card-bg p-6"
      >
        <h2 className="text-xl font-semibold leading-snug text-text-primary">
          Pairing failed unexpectedly
        </h2>
        <p className="mt-3 text-base leading-relaxed text-text-secondary">{message}</p>
        <div className="mt-6 flex gap-3">
          {reset && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
            >
              Try again
            </button>
          )}
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
          >
            Open onboarding
          </a>
        </div>
      </section>
    </div>
  )
}

/**
 * MalformedPairUrl — rendered by router.tsx errorComponent when the search
 * params fail Zod validation. Lives outside pair.lazy.tsx so it can be
 * eager-imported by router.tsx without defeating per-route code-splitting.
 */
export function MalformedPairUrl() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
      <section role="status" className="rounded-md border border-border-subtle bg-card-bg p-6">
        <h2 className="text-xl font-semibold leading-snug text-text-primary">
          This pair URL doesn&apos;t look right
        </h2>
        <p className="mt-3 text-base leading-relaxed text-text-secondary">
          The <code className="font-mono text-sm">agent</code> or{' '}
          <code className="font-mono text-sm">token</code> parameters didn&apos;t validate. Open{' '}
          <a href="/onboarding" className="text-accent hover:underline">
            /onboarding
          </a>{' '}
          and click the pair URL printed by the agent.
        </p>
        <a
          href="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
        >
          Open onboarding
        </a>
      </section>
    </div>
  )
}
