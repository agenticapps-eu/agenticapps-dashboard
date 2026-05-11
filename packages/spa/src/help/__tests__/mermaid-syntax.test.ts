// @vitest-environment jsdom
/**
 * Plan 07-04 Task 4 — Mermaid syntax validation.
 *
 * Reads each .mdx file from disk, extracts <MermaidBlock code={...} /> JSX
 * blocks, and validates each via mermaid.parse(). Catches typos at commit
 * time — without this, Plan 07-05 e2e would catch them only at browser render.
 *
 * NOTE on environment: mermaid v11 unconditionally initialises DOMPurify in
 * its sanitizer module, which requires a window/DOM. The plan's
 * `@vitest-environment node` directive would have left DOMPurify unconfigured
 * (TypeError: DOMPurify.addHook is not a function). Using jsdom satisfies
 * mermaid's DOM expectations while still letting `parse()` do pure syntax
 * validation (no rendering). [Rule 3 - Blocking] auto-fix from the plan's
 * stated assumption.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-RESEARCH.md Pitfall 6
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import mermaid from 'mermaid'
import { describe, it, expect } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGES_DIR = resolve(HERE, '..', 'pages')

const MERMAID_FILES = [
  'landing.mdx',
  'workflow/overview.mdx',
  'repos/overview.mdx',
  'observability/overview.mdx',
] as const

/**
 * Extract every <MermaidBlock code={`...`} /> block's code string from MDX source.
 * Captures the contents of the template literal that follows code={.
 * Handles single-line and multi-line template literals.
 */
function extractMermaidBlocks(mdxSource: string): string[] {
  const blocks: string[] = []
  const re = /<MermaidBlock\s+code=\{`([\s\S]*?)`\}\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(mdxSource)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

describe('Mermaid syntax validation (Plan 07-04 anchor MDX)', () => {
  mermaid.initialize({ startOnLoad: false })

  it.each(MERMAID_FILES)('%s mermaid blocks all parse without syntax errors', async (relPath) => {
    const filePath = resolve(PAGES_DIR, relPath)
    const source = readFileSync(filePath, 'utf8')
    const blocks = extractMermaidBlocks(source)
    expect(blocks.length).toBeGreaterThan(0)
    for (const code of blocks) {
      await expect(mermaid.parse(code, { suppressErrors: false })).resolves.toBeTruthy()
    }
  })

  it('operations/install.mdx has zero Mermaid blocks (sanity)', () => {
    const source = readFileSync(resolve(PAGES_DIR, 'operations/install.mdx'), 'utf8')
    expect(extractMermaidBlocks(source).length).toBe(0)
  })

  it('total mermaid block count is 5: landing 1 + workflow 1 + repos 1 + observability 2', () => {
    let total = 0
    for (const rel of MERMAID_FILES) {
      const source = readFileSync(resolve(PAGES_DIR, rel), 'utf8')
      total += extractMermaidBlocks(source).length
    }
    expect(total).toBe(5)
  })
})
