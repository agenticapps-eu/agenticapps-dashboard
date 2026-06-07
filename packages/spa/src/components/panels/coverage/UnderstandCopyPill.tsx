/**
 * UnderstandCopyPill.tsx — Composite cell content for the Understand column.
 *
 * 3-state render (D-14-06, D-14-08, D-14-10):
 *   - fresh:   viewer link only (✓ doubles as a new-tab link)
 *   - stale:   viewer link + copy pill (stale row keeps its link — D-14-10)
 *   - missing: copy pill only
 *
 * Viewer link opens in a new tab at the per-repo viewer URL (D-14-07).
 * rel="noopener noreferrer" guards reverse-tabnabbing (T-14-03-02).
 *
 * Copy pill writes `cd ~/Sourcecode/{family}/{repo} && claude "/understand"` to
 * clipboard via the shared buildUnderstandCommand helper (D-14-10, T-14-03-03).
 * Toast feedback mirrors InstallGitNexusButton pattern.
 *
 * Constraints (D-5.1-10): no utility-merge helpers, no hex literals, no shadcn aliases.
 */
import React from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { buildUnderstandCommand } from '@agenticapps/dashboard-shared'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { useToast } from '../../ui/Toast.js'

export interface UnderstandCopyPillProps {
  family: string
  repo: string
  /**
   * Fully-built viewer URL: `{agentUrl}/understand/{family}/{repo}/?token={viewerToken}`.
   * URL construction is the parent's responsibility (CoveragePage / CoverageRow).
   * When absent (no pairing or no viewerToken), the viewer link is suppressed.
   */
  viewerUrl?: string
  /** 3-state: fresh (link only) | stale (link + pill) | missing (pill only) */
  state: 'fresh' | 'stale' | 'missing'
}

export function UnderstandCopyPill({
  family,
  repo,
  viewerUrl,
  state,
}: UnderstandCopyPillProps): React.JSX.Element {
  const toast = useToast()
  // buildUnderstandCommand throws on non-slug family/repo names (shell-safety,
  // Phase 14 review fix). Daemon-side mint validation already degrades such
  // rows, but guard the render path too: no safe command → no copy pill.
  let cmdString: string | null = null
  try {
    cmdString = buildUnderstandCommand(family, repo).string
  } catch {
    cmdString = null
  }

  // Viewer link is shown for fresh and stale states when viewerUrl is set.
  const showLink = (state === 'fresh' || state === 'stale') && !!viewerUrl
  // Copy pill is shown for stale and missing states (when a safe command exists).
  const showPill = (state === 'stale' || state === 'missing') && cmdString !== null

  return (
    <div className="flex items-center gap-2">
      {showLink && (
        <a
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md text-xs text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Open knowledge graph for ${repo} in new tab`}
        >
          View <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      {showPill && (
        <button
          type="button"
          onClick={async () => {
            const ok = await writeToClipboard(cmdString!)
            toast.show(
              ok
                ? { message: 'Copied — paste in terminal to analyze', variant: 'success' }
                : { message: 'Copy failed — see help guide for the command.', variant: 'error' },
            )
          }}
          aria-label={`Copy understand command for ${repo} to clipboard`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-secondary bg-card-bg-hover hover:bg-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Copy size={12} aria-hidden="true" />
          /understand
        </button>
      )}
    </div>
  )
}
