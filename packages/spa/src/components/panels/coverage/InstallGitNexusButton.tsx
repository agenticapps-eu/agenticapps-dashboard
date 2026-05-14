/**
 * InstallGitNexusButton.tsx — Primary-action button shown in place of
 * RefreshAllStaleButton when GitNexus isn't installed (D-10.5 / impeccable P0).
 *
 * Pre-fix the page rendered "Refresh 0 stale" (disabled) as its primary action,
 * even when every gitNexus column was not-applicable because the binary was
 * missing. The label confused first-timers staring at a page full of red cells.
 *
 * This component renders the actual primary action for that state — copying
 * the install command to clipboard.
 *
 * Constraints (D-5.1-10): NO cn()/clsx/CVA, NO hex literals, NO shadcn aliases.
 */
import React from 'react'
import { Download } from 'lucide-react'
import { buildGitnexusInstallClipboardString } from '@agenticapps/dashboard-shared'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'

export function InstallGitNexusButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => void writeToClipboard(buildGitnexusInstallClipboardString())}
      aria-label="Copy npm install -g gitnexus to clipboard"
      className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-card-bg hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Download size={14} aria-hidden="true" />
      Install GitNexus
    </button>
  )
}
