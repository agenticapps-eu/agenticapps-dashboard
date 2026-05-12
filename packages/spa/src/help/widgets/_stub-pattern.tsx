/**
 * Widget stub primitive — the shared visual for every v1.0 stub widget.
 *
 * Plan 07-03 ships 8 concrete stubs in sibling files; this file ONLY contains
 * the shared `WidgetStub` primitive (the 8 concrete stubs from the migration
 * source `_stub-pattern.tsx` are split out per migration Step 5 close).
 *
 * v1.2 replaces each concrete stub with a real implementation; this primitive
 * is replaced or retained per the real widget's needs.
 */
import { Sparkles } from 'lucide-react'

export interface WidgetStubProps {
  /** Name shown to user. */
  title: string
  /** What the real widget will do, in one sentence. */
  description: string
  /** Optional emoji for the placeholder. Defaults to ✨. */
  emoji?: string
}

export function WidgetStub({ title, description, emoji = '✨' }: WidgetStubProps): React.JSX.Element {
  return (
    <div className="not-prose rounded-md bg-sidebar-bg p-6 text-center">
      <div className="text-3xl mb-2" role="img" aria-label="placeholder">
        {emoji}
      </div>
      <h3 className="font-semibold text-base mb-1 text-text-primary">
        {title}{' '}
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
          <Sparkles size={10} />
          Coming v1.2
        </span>
      </h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">{description}</p>
    </div>
  )
}
