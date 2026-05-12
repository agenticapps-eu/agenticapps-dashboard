/**
 * ComingSoon — fallback for v1.0 stub pages.
 *
 * Source: ~/Documents/.../ComingSoon.tsx (translated to @tanstack/react-router
 * Link + tokens.css names per Plan 07-02 token translation table).
 *
 * Back-link target:
 *   - 'operations' has no /overview in v1.0 — falls back to /install.
 *   - 'reference' has no /overview either — falls back to /shortcuts (the
 *     only ready anchor under reference; was redirecting to landing via
 *     catch-all before the v1.0.0 review fix).
 *   - All other sections back-link to /help/<section>/overview.
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Construction } from 'lucide-react'

export interface ComingSoonProps {
  title: string
  section: string
}

export function ComingSoon({ title, section }: ComingSoonProps): React.JSX.Element {
  // Per-section fallback: operations → /install, reference → /shortcuts, else → /overview.
  const fallbackPath =
    section === 'operations'
      ? '/help/operations/install'
      : section === 'reference'
        ? '/help/reference/shortcuts'
        : `/help/${section}/overview`

  return (
    <div className="my-12">
      <div className="rounded-lg border-2 border-dashed border-border-subtle bg-sidebar-bg/60 px-8 py-12 text-center">
        <Construction size={40} className="mx-auto mb-4 text-text-secondary" />
        <h1 className="text-2xl font-semibold mb-2 text-text-primary">{title}</h1>
        <p className="text-text-secondary mb-6 max-w-md mx-auto">
          This page is on the roadmap but hasn&apos;t been written yet. The v1.0 docs site ships
          with five anchor pages; deeper topic coverage lands in v1.1.
        </p>
        <Link
          to={fallbackPath}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-card-bg hover:bg-accent-hover"
        >
          <ArrowLeft size={14} />
          Back to {section} overview
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-text-secondary">
        Track progress on{' '}
        <a
          href={`https://github.com/agenticapps-eu/agenticapps-dashboard/issues?q=is%3Aissue+label%3Adocs+${encodeURIComponent(title)}`}
          className="underline hover:text-text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub issues
        </a>{' '}
        or contribute via{' '}
        <Link to="/help/reference/contributing" className="underline hover:text-text-primary">
          Contributing
        </Link>
        .
      </p>
    </div>
  )
}
