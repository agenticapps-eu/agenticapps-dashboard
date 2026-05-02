import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

const FALLBACK: HealthResponse = {
  ok: false,
  version: 'not running',
  message: 'Agent not running',
}

// Parse the fallback so a schema drift in shared surfaces immediately at
// build/test time instead of silently rendering bad data.
const fallbackParsed = HealthResponseSchema.parse(FALLBACK)

export function App() {
  // Phase 0: no fetch wired. VITE_AGENT_URL feature toggle reserved for Phase 1+.
  // The agent URL is read from import.meta.env in later phases; for now we
  // render the static fallback (which is itself schema-validated above).
  const health = fallbackParsed

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          AgenticApps Dashboard <span className="text-neutral-500">— alpha</span>
        </h1>
        <p className="text-sm text-neutral-400">
          Multi-project pipeline visibility for the AgenticApps Superpowers + GSD + gstack stack.
        </p>
      </header>

      <section
        role="status"
        aria-label="Agent status"
        data-testid="agent-version"
        className="rounded border border-neutral-800 bg-neutral-900/60 p-4"
      >
        <div className="text-xs uppercase tracking-wide text-neutral-500">Local agent</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-mono text-lg">{health.version}</span>
          <span className={health.ok ? 'text-xs text-emerald-400' : 'text-xs text-amber-400'}>
            {health.ok ? 'reachable' : 'Agent not running'}
          </span>
        </div>
        {health.message ? (
          <p className="mt-2 text-sm text-neutral-400">{health.message}</p>
        ) : null}
      </section>

      <footer className="text-xs text-neutral-600">
        v0.0.1-alpha.2 · Phase 0 placeholder · daemon arrives in Phase 1
      </footer>
    </main>
  )
}
