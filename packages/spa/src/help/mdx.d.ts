/**
 * Ambient TypeScript declaration for *.mdx imports.
 *
 * Plan 07-01 Task 4 — establishes the type contract that Wave 1+ MDX
 * modules will satisfy. `frontmatter` named export comes from
 * remark-mdx-frontmatter (default export key = "frontmatter").
 *
 * See `.planning/phases/07-help-docs-v1-0/07-CONTEXT.md` D-7-04.
 */
declare module '*.mdx' {
  import type { ComponentType } from 'react'

  /** The compiled MDX module — a zero-arg React component. */
  const MDXComponent: ComponentType
  export default MDXComponent

  /** Frontmatter named export, populated by remark-mdx-frontmatter. */
  export const frontmatter: {
    slug: string
    title: string
    order: number
    section: string
  }
}
