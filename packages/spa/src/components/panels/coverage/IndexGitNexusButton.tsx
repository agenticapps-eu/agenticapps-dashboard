/**
 * IndexGitNexusButton.tsx — primary-action CTA shown when GitNexus is installed
 * but the registry hasn't been created yet (10.6: `installed-no-registry` state).
 *
 * Pre-10.6 the page rendered the "Install GitNexus" CTA in this state — wrong
 * advice, because the user already has the binary. The actual next step is to
 * run `gitnexus analyze` in any git repo, which creates `~/.gitnexus/registry.json`
 * and unlocks the normal stale/fresh matrix.
 *
 * Behavior parallels InstallGitNexusButton: clipboard-only, no daemon round-trip.
 * Visual treatment matches the install variant — same accent-on-card slot — so
 * users notice the *label change* between states rather than a button-shape change.
 *
 * Constraints (D-5.1-10): NO cn()/clsx/CVA, NO hex literals, NO shadcn aliases.
 */
import React from 'react'
import { Sparkles } from 'lucide-react'
import { buildGitnexusIndexClipboardString } from '@agenticapps/dashboard-shared'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { useToast } from '../../ui/Toast.js'

export function IndexGitNexusButton(): React.JSX.Element {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await writeToClipboard(buildGitnexusIndexClipboardString())
        toast.show(
          ok
            ? { message: 'Copied — paste in terminal to index your repos with GitNexus', variant: 'success' }
            : { message: 'Copy failed — open the help guide for the command.', variant: 'error' },
        )
      }}
      aria-label="Copy gitnexus analyze to clipboard"
      className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-card-bg hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Sparkles size={14} aria-hidden="true" />
      Index with GitNexus
    </button>
  )
}
