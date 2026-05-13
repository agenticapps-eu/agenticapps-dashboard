/**
 * Test scaffold for CoverageRow.tsx — single repo row with 4 cells + override chip + refresh popover.
 * Plan 06 implements; Plan 01 provides the it.todo placeholders.
 *
 * CODEX HIGH-1 SPA-side enforcement: absPath must NEVER be rendered in the DOM.
 */

import { describe, it } from 'vitest'

describe('CoverageRow', () => {
  it.todo('renders 4 cells in the correct order: claudeMd, gitNexus, wiki, workflowVersion')
  it.todo(
    'renders OverrideChip component ONLY when overrideCount > 0 (not rendered when overrideCount === 0)'
  )
  it.todo(
    'refresh button appears on hover and keyboard focus (not visible in default non-focused state)'
  )
  it.todo('refresh popover dismisses on outside-click and Escape key press')
  it.todo(
    'absPath NEVER rendered in DOM (CODEX HIGH-1 SPA-side enforcement) — row receives no absPath prop and renders none in output HTML'
  )
})
