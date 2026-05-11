import { AlertTriangle } from 'lucide-react'

export type DaemonUnreachableStateProps = {
  agentUrl: string
  onRetry: () => void
}

export function DaemonUnreachableState({ agentUrl, onRetry }: DaemonUnreachableStateProps) {
  return (
    <section
      role="status"
      className="rounded-card border border-border-subtle bg-card-bg p-6"
    >
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden="true" className="text-status-warning" />
        <h2 className="text-xl font-semibold leading-snug text-text-primary">Daemon not running</h2>
      </header>
      <p className="mt-3 text-base leading-relaxed text-text-secondary">
        Couldn&apos;t reach the agent at{' '}
        <code className="rounded bg-card-bg-hover px-2 font-mono text-sm">{agentUrl}</code>.
        Start it with{' '}
        <code className="rounded bg-card-bg-hover px-2 font-mono text-sm">agentic-dashboard start</code>{' '}
        and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        Try again
      </button>
    </section>
  )
}
