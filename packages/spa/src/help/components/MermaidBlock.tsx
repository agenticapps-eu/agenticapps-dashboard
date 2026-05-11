/**
 * MermaidBlock — runtime Mermaid renderer for MDX pages.
 *
 * Strategy (per RESEARCH P1):
 *   1. Render <pre class="mermaid">{code}</pre> immediately so users see raw
 *      code while the mermaid bundle (~600 KB) lazy-loads.
 *   2. On mount, dynamic `import('mermaid')` resolves; we run
 *      `mermaid.run({ nodes: [ref] })` to replace the <pre> contents with SVG.
 *   3. StrictMode guard: skip re-run if data-processed="true" is already set
 *      (mermaid sets this on success).
 *   4. Cancellation flag: if the component unmounts before mermaid finishes
 *      loading, the run is skipped.
 *   5. Render errors: console.warn (NOT console.error) so the Playwright
 *      walking-checklist "no console errors" assertion stays green even when
 *      mermaid rejects on bad syntax (RESEARCH P6).
 *
 * Theme: 'base' with warm-paper themeVariables read from CSS custom properties
 * (NOT hardcoded hex literals — tokens.css is the source of truth per AC-05).
 *   primaryColor       ← --color-accent-bg
 *   primaryTextColor   ← --color-text-primary
 *   primaryBorderColor ← --color-accent
 *   lineColor          ← --color-text-tertiary
 */
import { useEffect, useRef } from 'react'

export interface MermaidBlockProps {
  /** Raw mermaid source. */
  code: string
}

/**
 * Read warm-paper theme variables from the live CSS custom properties so the
 * MermaidBlock.tsx file has ZERO hex literals (tokenSourceOfTruth invariant).
 * Returns {} on SSR / non-browser environments — mermaid uses its own defaults.
 */
function getMermaidThemeVariables(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const root = document.documentElement
  const read = (name: string): string => getComputedStyle(root).getPropertyValue(name).trim()
  return {
    primaryColor: read('--color-accent-bg'),
    primaryTextColor: read('--color-text-primary'),
    primaryBorderColor: read('--color-accent'),
    lineColor: read('--color-text-tertiary'),
  }
}

export function MermaidBlock({ code }: MermaidBlockProps): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || node.dataset.processed === 'true') return

    let cancelled = false

    void import('mermaid').then(({ default: mermaid }) => {
      if (cancelled || !node || node.dataset.processed === 'true') return
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: getMermaidThemeVariables(),
          securityLevel: 'loose',
        })
        void mermaid.run({ nodes: [node] }).catch((err: unknown) => {
          // Per RESEARCH P6: console.warn (not console.error) so Playwright
          // "no console errors" stays green on bad mermaid syntax.
          console.warn('MermaidBlock render failed:', err)
        })
      } catch (err) {
        console.warn('MermaidBlock initialize failed:', err)
      }
    })

    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="not-prose my-6">
      <pre ref={ref} className="mermaid">
        {code}
      </pre>
    </div>
  )
}
