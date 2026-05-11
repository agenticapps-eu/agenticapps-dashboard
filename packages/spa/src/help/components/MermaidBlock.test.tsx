/**
 * Plan 07-02 Task 5 — MermaidBlock smoke + StrictMode-safety unit tests.
 *
 * Per D-7-15: smoke only — renders <pre class="mermaid"> slot.
 * SVG assertion deferred to Plan 07-05 Playwright e2e (jsdom doesn't run mermaid).
 *
 * @see .planning/phases/07-help-docs-v1-0/07-RESEARCH.md §Pitfall 1 + §Pitfall 9
 */
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, it, expect, vi } from 'vitest'

// Mock the mermaid dynamic import; vitest's vi.doMock applies to the whole module.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}))

import { MermaidBlock } from './MermaidBlock'

const SAMPLE_CODE = 'flowchart LR\n  A --> B'

describe('MermaidBlock', () => {
  it('renders <pre class="mermaid"> with the raw code as text content', () => {
    render(<MermaidBlock code={SAMPLE_CODE} />)
    const pre = screen.getByText(/A --> B/)
    expect(pre.tagName).toBe('PRE')
    expect(pre.className).toContain('mermaid')
  })

  it('wraps the <pre> in a not-prose container so MDX prose styles do not bleed in', () => {
    const { container } = render(<MermaidBlock code={SAMPLE_CODE} />)
    expect(container.querySelector('.not-prose')).toBeInTheDocument()
  })

  it('survives StrictMode double-mount without throwing (data-processed guard)', () => {
    expect(() => {
      render(
        <StrictMode>
          <MermaidBlock code={SAMPLE_CODE} />
        </StrictMode>,
      )
    }).not.toThrow()
  })

  it('renders inline (mermaid library import is async; SVG appearance is deferred to e2e)', () => {
    render(<MermaidBlock code={SAMPLE_CODE} />)
    // We do NOT assert on SVG — jsdom doesn't run the renderer. The Playwright
    // walking checklist (Plan 07-05) asserts SVG visibility after networkidle.
    expect(screen.getByText(/A --> B/)).toBeInTheDocument()
  })
})
