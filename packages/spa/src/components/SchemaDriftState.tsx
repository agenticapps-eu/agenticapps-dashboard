import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ZodIssue } from 'zod'

export type SchemaDriftStateProps = {
  firstIssue: { path: string; expected: string; got: string }
  fullIssues: ZodIssue[]
  onRetry: () => void
}

export function SchemaDriftState({ firstIssue, fullIssues, onRetry }: SchemaDriftStateProps) {
  return (
    <section
      role="status"
      className="rounded-card border border-border-subtle bg-card-bg p-6"
    >
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden="true" className="text-status-error" />
        <h2 className="text-xl font-semibold leading-snug text-text-primary">Schema drift detected</h2>
      </header>
      <p className="mt-3 text-base leading-relaxed text-text-secondary">
        The agent and dashboard disagree on the shape of this response. Update both ends to match.
      </p>
      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1 font-mono text-sm">
        <dt className="text-text-secondary">field:</dt>
        <dd className="text-text-primary">{firstIssue.path}</dd>
        <dt className="text-text-secondary">expected:</dt>
        <dd className="text-text-primary">{firstIssue.expected}</dd>
        <dt className="text-text-secondary">got:</dt>
        <dd className="text-text-primary">{firstIssue.got}</dd>
      </dl>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg">
          Show full diff
        </summary>
        <pre className="mt-2 max-h-60 overflow-auto rounded bg-card-bg-hover p-4 font-mono text-sm text-text-primary">
          {JSON.stringify(fullIssues, null, 2)}
        </pre>
      </details>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card-bg-hover px-4 py-2 text-sm font-semibold text-text-primary hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Retry request
      </button>
    </section>
  )
}
