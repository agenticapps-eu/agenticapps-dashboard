/**
 * MalformedPairUrl — rendered by router.tsx errorComponent when the search
 * params fail Zod validation. Lives outside pair.lazy.tsx so it can be
 * eager-imported by router.tsx without defeating per-route code-splitting.
 */
export function MalformedPairUrl() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8">
      <section role="status" className="rounded-md border border-[--border] bg-[--surface] p-6">
        <h2 className="text-xl font-semibold leading-snug text-[--text]">
          This pair URL doesn&apos;t look right
        </h2>
        <p className="mt-3 text-base leading-relaxed text-[--text-muted]">
          The <code className="font-mono text-sm">agent</code> or{' '}
          <code className="font-mono text-sm">token</code> parameters didn&apos;t validate. Open{' '}
          <a href="/onboarding" className="text-[--accent] hover:underline">
            /onboarding
          </a>{' '}
          and click the pair URL printed by the agent.
        </p>
        <a
          href="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-[--border-strong] bg-[--surface-elevated] px-4 py-2 text-sm font-semibold text-[--text] hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
        >
          Open onboarding
        </a>
      </section>
    </div>
  )
}
