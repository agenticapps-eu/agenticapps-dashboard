/**
 * mdxComponents — global component map passed to <MDXProvider>.
 *
 * Plan 07-01: empty stub.
 * Plan 07-02: + { HelpWidget, HelpHook, ComingSoon, MermaidBlock }.
 * Plan 07-05 (this update): + { KbdHint, pre: MermaidPreOrDefault }.
 *
 * MDX pages can reference these components by name without explicit imports:
 *   <HelpWidget name="RepoTopologyMap" />
 *   <HelpHook topic="workflow.gates" />
 *   <KbdHint keys="Cmd" />
 *
 * `pre` is a defensive fallback: if a future MDX author writes a
 * ```mermaid``` block (triple-backtick fence), the default MDX renderer would
 * produce <pre><code className="language-mermaid">…</code></pre>. The
 * MermaidPreOrDefault wrapper detects that and routes through MermaidBlock.
 * For v1.0, all Mermaid is JSX (Plan 07-04 Task 1), so `pre` falls through
 * to default rendering on every existing block.
 *
 * Keep this file lean — main.tsx imports it on module load.
 */
import type { ReactElement, ReactNode } from 'react'
import type { MDXComponents } from 'mdx/types'

import { KbdHint } from '../components/ui/KbdHint.js'

import { ComingSoon } from './components/ComingSoon.js'
import { HelpHook } from './components/HelpHook.js'
import { HelpWidget } from './components/HelpWidget.js'
import { MermaidBlock } from './components/MermaidBlock.js'

function MermaidPreOrDefault(
  props: React.HTMLAttributes<HTMLPreElement> & { children?: ReactNode },
): ReactElement {
  const child = Array.isArray(props.children) ? props.children[0] : props.children
  if (
    child &&
    typeof child === 'object' &&
    'props' in child &&
    typeof (child as { props: { className?: string } }).props.className === 'string' &&
    (child as { props: { className: string } }).props.className.includes('language-mermaid')
  ) {
    const codeNode = child as { props: { children?: ReactNode } }
    const code = typeof codeNode.props.children === 'string' ? codeNode.props.children : ''
    return <MermaidBlock code={code} />
  }
  return <pre {...props} />
}

export const mdxComponents: MDXComponents = {
  HelpWidget,
  HelpHook,
  ComingSoon,
  MermaidBlock,
  KbdHint,
  pre: MermaidPreOrDefault,
}
