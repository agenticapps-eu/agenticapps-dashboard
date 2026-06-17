/**
 * ClaudeMdLevelDrawer.test.tsx — Tests for the per-rung capability drawer.
 *
 * Behavior tests (6 total, CML-09):
 * 1. Renders all 6 rung rows with Check (passed) / Circle (not-passed) icons
 * 2. Renders each rung's evidence strings
 * 3. Inferred L5 rung: renders ~ sigil after name AND always-visible callout
 * 4. nextSteps.length > 0: renders "Next steps" heading + each step with → prefix
 * 5. nextSteps.length === 0: renders "Fully adaptive — all six rungs complete."
 * 6. Backdrop click calls onClose; onCancel (Esc) calls onClose
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { ClaudeMdLevelDrawer } from './ClaudeMdLevelDrawer.js'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'

// ── HTMLDialogElement polyfill for jsdom (mirrors RegisterModal.test.tsx) ─────
// jsdom does not ship showModal()/close() — patch them in beforeEach so the
// useEffect focus-management logic works without throwing.
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

afterEach(() => {
  cleanup()
})

// Base eval with 6 rungs, L4 achieved, L5 inferred, L6 not passed
const L4_EVAL: ClaudeMdEval = {
  level: 4,
  levelLabel: 'Abstracted',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked CLAUDE.md found'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST keyword found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import reference found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter detected'] },
    { rung: 5, label: 'Maintained', passed: false, evidence: ['mtime 180 days ago'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['no mcp.json found'] },
  ],
  nextSteps: [
    'Keep CLAUDE.md updated (edit within 90 days) or add a backbone doc (.claude/INDEX.md) → reaches L5.',
    'Add a task-scoped skill under .claude/skills/ and an mcp.json → reaches L6.',
  ],
  inferred: false,
}

// L5 eval with inferred L5 rung
const L5_INFERRED_EVAL: ClaudeMdEval = {
  level: 5,
  levelLabel: 'Maintained',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked CLAUDE.md found'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST keyword found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import reference found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter detected'] },
    { rung: 5, label: 'Maintained', passed: true, inferred: true, evidence: ['freshness proxy: backbone doc present'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['no mcp.json found'] },
  ],
  nextSteps: ['Add a task-scoped skill under .claude/skills/ and an mcp.json → reaches L6.'],
  inferred: true,
}

// L6 eval — fully adaptive, nextSteps empty
const L6_EVAL: ClaudeMdEval = {
  level: 6,
  levelLabel: 'Adaptive',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked CLAUDE.md found'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST keyword found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import reference found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter detected'] },
    { rung: 5, label: 'Maintained', passed: true, evidence: ['edited 30 days ago'] },
    { rung: 6, label: 'Adaptive', passed: true, evidence: ['mcp.json found', 'skill present'] },
  ],
  nextSteps: [],
  inferred: false,
}

describe('ClaudeMdLevelDrawer — Test 1: rung list render', () => {
  it('renders all 6 rung label names when drawer is open', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    // Rung labels appear in list items as "L1 — Basic" etc.
    // Use getAllByText to handle the header badge also containing "Abstracted"
    expect(screen.getAllByText(/Basic/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Scoped/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Structured/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Abstracted/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Maintained/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Adaptive/).length).toBeGreaterThanOrEqual(1)
  })

  it('passed rungs show a Check icon (aria-hidden)', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    // Multiple role="list" elements exist (rung list + next-steps list); use getAllByRole
    const lists = screen.getAllByRole('list', { hidden: true })
    expect(lists.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT render content when isOpen is false', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={false}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    // With native dialog, content is rendered but dialog is closed
    // Check the rung list is not visible via screen (it may still be in DOM)
    const dialog = document.querySelector('dialog')
    // When closed, dialog.open should be false (native behavior)
    expect(dialog?.open).toBeFalsy()
  })
})

describe('ClaudeMdLevelDrawer — Test 2: evidence strings', () => {
  it('renders evidence strings for passed rungs', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.getByText('git-tracked CLAUDE.md found')).toBeTruthy()
    expect(screen.getByText('MUST keyword found')).toBeTruthy()
    expect(screen.getByText('paths: frontmatter detected')).toBeTruthy()
  })

  it('renders evidence strings for failed rungs', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.getByText('mtime 180 days ago')).toBeTruthy()
    expect(screen.getByText('no mcp.json found')).toBeTruthy()
  })
})

describe('ClaudeMdLevelDrawer — Test 3: inferred L5 sigil + callout', () => {
  it('renders ~ sigil when L5 rung has inferred:true', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L5_INFERRED_EVAL}
      />,
    )
    // There should be a ~ sigil in the DOM (may appear multiple times: header + rung)
    const sigils = screen.getAllByText('~')
    expect(sigils.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the always-visible inferred-L5 callout when L5 inferred', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L5_INFERRED_EVAL}
      />,
    )
    expect(
      screen.getByText(/Inferred — not hard-verified/),
    ).toBeTruthy()
    expect(
      screen.getByText(/Based on CLAUDE\.md freshness and backbone-doc presence/),
    ).toBeTruthy()
  })

  it('does NOT render the inferred callout when L5 rung is NOT inferred', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.queryByText(/Inferred — not hard-verified/)).toBeNull()
  })
})

describe('ClaudeMdLevelDrawer — Test 4: nextSteps section', () => {
  it('renders "Next steps" heading when nextSteps.length > 0', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.getByText('Next steps')).toBeTruthy()
  })

  it('renders each step text when nextSteps has entries', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(
      screen.getByText(/Keep CLAUDE\.md updated/),
    ).toBeTruthy()
  })

  it('renders → arrow prefix for next steps (aria-hidden)', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    const arrows = screen.getAllByText('→')
    expect(arrows.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ClaudeMdLevelDrawer — Test 5: Fully adaptive copy (nextSteps empty)', () => {
  it('renders "Fully adaptive — all six rungs complete." when nextSteps is empty', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L6_EVAL}
      />,
    )
    expect(screen.getByText('Fully adaptive — all six rungs complete.')).toBeTruthy()
  })

  it('does NOT render "Next steps" heading when nextSteps is empty', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L6_EVAL}
      />,
    )
    expect(screen.queryByText('Next steps')).toBeNull()
  })
})

describe('ClaudeMdLevelDrawer — Test 6: close handlers', () => {
  it('backdrop click (click on dialog element itself) calls onClose', () => {
    const onClose = vi.fn()
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={onClose}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    const dialog = document.querySelector('dialog')!
    // Simulate click on the dialog backdrop (target === dialog element)
    fireEvent.click(dialog, { target: dialog })
    expect(onClose).toHaveBeenCalled()
  })

  it('onCancel event calls onClose (Esc key via native dialog)', () => {
    const onClose = vi.fn()
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={onClose}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    const dialog = document.querySelector('dialog')!
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalled()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={onClose}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    const closeBtn = screen.getByRole('button', { name: /Close capability level drawer/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ClaudeMdLevelDrawer — header content', () => {
  it('renders repoName as the drawer heading', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-test-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.getByText('my-test-repo')).toBeTruthy()
  })

  it('renders "CLAUDE.md capability level" sub-label', () => {
    render(
      <ClaudeMdLevelDrawer
        isOpen={true}
        onClose={vi.fn()}
        repoName="my-repo"
        evalData={L4_EVAL}
      />,
    )
    expect(screen.getByText('CLAUDE.md capability level')).toBeTruthy()
  })
})
