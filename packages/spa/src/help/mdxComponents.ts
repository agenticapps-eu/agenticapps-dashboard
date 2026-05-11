/**
 * mdxComponents — global component map passed to <MDXProvider>.
 *
 * Plan 07-01: stub (empty).
 * Plan 07-02: adds { HelpWidget, HelpHook, MermaidBlock, ComingSoon }.
 * Plan 07-05: finalises with { ..., KbdHint, pre: MermaidPreOrDefault }.
 *
 * Keep this file minimal — it is imported by main.tsx and must not pull
 * in heavy dependencies.
 */
import type { MDXComponents } from 'mdx/types'

export const mdxComponents: MDXComponents = {}
