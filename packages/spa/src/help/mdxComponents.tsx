/**
 * mdxComponents — global component map passed to <MDXProvider>.
 *
 * Plan 07-01: empty stub.
 * Plan 07-02 (this update): adds { HelpWidget, HelpHook, ComingSoon, MermaidBlock }.
 * Plan 07-05: adds { KbdHint, pre: MermaidPreOrDefault } to finalise the map.
 *
 * MDX pages can reference these components by name without explicit imports:
 *   <HelpWidget name="RepoTopologyMap" />
 *   <HelpHook topic="workflow.gates" />
 *
 * Keep this file lean — main.tsx imports it on module load.
 */
import type { MDXComponents } from 'mdx/types'

import { ComingSoon } from './components/ComingSoon.js'
import { HelpHook } from './components/HelpHook.js'
import { HelpWidget } from './components/HelpWidget.js'
import { MermaidBlock } from './components/MermaidBlock.js'

export const mdxComponents: MDXComponents = {
  HelpWidget,
  HelpHook,
  ComingSoon,
  MermaidBlock,
}
