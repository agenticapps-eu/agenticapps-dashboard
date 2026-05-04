import { AlertTriangle } from 'lucide-react'

export type DaemonUnreachableStateProps = {
  agentUrl: string
  onRetry: () => void
}

export function DaemonUnreachableState({ agentUrl, onRetry }: DaemonUnreachableStateProps) {
  return (
    <section
      role="status"
      className="rounded-md border border-[--border] bg-[--surface] p-6"
    >
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden="true" className="text-[--warning]" />
        <h2 className="text-xl font-semibold leading-snug text-[--text]">Daemon not running</h2>
      </header>
      <p className="mt-3 text-base leading-relaxed text-[--text-muted]">
        Couldn&apos;t reach the agent at{' '}
        <code className="rounded bg-[--surface-elevated] px-2 font-mono text-sm">{agentUrl}</code>.
        Start it with{' '}
        <code className="rounded bg-[--surface-elevated] px-2 font-mono text-sm">agentic-dashboard start</code>{' '}
        and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-[--border-strong] bg-[--surface-elevated] px-4 py-2 text-sm font-semibold text-[--text] hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg]"
      >
        Try again
      </button>
    </section>
  )
}
