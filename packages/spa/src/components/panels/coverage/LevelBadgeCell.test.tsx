/**
 * LevelBadgeCell.test.tsx — Tests for the L-level badge cell component.
 *
 * Behavior tests (5 total, CML-08):
 * 1. Renders L4 badge label inside a button
 * 2. Renders em-dash "—" with NO button when evalData is undefined (degraded)
 * 3. Shows inferred "~" sigil in button text when eval.inferred is true
 * 4. Clicking the button calls onClick exactly once
 * 5. aria-label is correct for normal, inferred, and degraded states
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { LevelBadgeCell } from './LevelBadgeCell.js'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'

afterEach(() => {
  cleanup()
})

const L4_EVAL: ClaudeMdEval = {
  level: 4,
  levelLabel: 'Abstracted',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter'] },
    { rung: 5, label: 'Maintained', passed: false, evidence: ['mtime 180d ago'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['no mcp.json'] },
  ],
  nextSteps: ['Keep CLAUDE.md updated (edit within 90 days) → L5.'],
  inferred: false,
}

const L5_INFERRED_EVAL: ClaudeMdEval = {
  level: 5,
  levelLabel: 'Maintained',
  rungs: [
    { rung: 1, label: 'Basic', passed: true, evidence: ['git-tracked'] },
    { rung: 2, label: 'Scoped', passed: true, evidence: ['MUST found'] },
    { rung: 3, label: 'Structured', passed: true, evidence: ['@import found'] },
    { rung: 4, label: 'Abstracted', passed: true, evidence: ['paths: frontmatter'] },
    { rung: 5, label: 'Maintained', passed: true, inferred: true, evidence: ['freshness proxy'] },
    { rung: 6, label: 'Adaptive', passed: false, evidence: ['no mcp.json'] },
  ],
  nextSteps: ['Add a task-scoped skill under .claude/skills/ and an mcp.json → reaches L6.'],
  inferred: true,
}

describe('LevelBadgeCell — Test 1: normal badge render', () => {
  it('renders a button with text containing L4 for L4 eval', () => {
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('L4')
  })

  it('button text does NOT contain ~ when inferred is false', () => {
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.getByRole('button').textContent).not.toContain('~')
  })
})

describe('LevelBadgeCell — Test 2: degraded state (evalData undefined)', () => {
  it('renders em-dash span when evalData is undefined', () => {
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('does NOT render a button when evalData is undefined', () => {
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('degraded span has aria-label containing "not available"', () => {
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={vi.fn()} />)
    const span = screen.getByText('—')
    expect(span.getAttribute('aria-label')).toContain('not available')
  })
})

describe('LevelBadgeCell — Test 3: inferred ~ sigil', () => {
  it('shows ~ in button text content when eval.inferred is true', () => {
    render(<LevelBadgeCell evalData={L5_INFERRED_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    expect(screen.getByRole('button').textContent).toContain('~')
  })

  it('button aria-label includes "inferred" when eval.inferred is true', () => {
    render(<LevelBadgeCell evalData={L5_INFERRED_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toContain('inferred')
  })
})

describe('LevelBadgeCell — Test 4: onClick callback', () => {
  it('calls onClick exactly once when button is clicked', () => {
    const onClick = vi.fn()
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does NOT call onClick when degraded (no button rendered)', () => {
    const onClick = vi.fn()
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={onClick} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('LevelBadgeCell — Test 5: aria-label strings', () => {
  it('normal aria-label: "CLAUDE.md level for {repo}: {levelLabel}. Click for details."', () => {
    render(<LevelBadgeCell evalData={L4_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toBe('CLAUDE.md level for my-repo: Abstracted. Click for details.')
  })

  it('inferred aria-label includes ", inferred" after levelLabel', () => {
    render(<LevelBadgeCell evalData={L5_INFERRED_EVAL} repoName="my-repo" onClick={vi.fn()} />)
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toBe('CLAUDE.md level for my-repo: Maintained, inferred. Click for details.')
  })

  it('degraded aria-label: "CLAUDE.md level for {repo}: not available"', () => {
    render(<LevelBadgeCell evalData={undefined} repoName="my-repo" onClick={vi.fn()} />)
    const span = screen.getByText('—')
    expect(span.getAttribute('aria-label')).toBe('CLAUDE.md level for my-repo: not available')
  })
})

describe('LevelBadgeCell — D-5.1-10 constraint: no cn/clsx/hex', () => {
  it('renders without throwing for all badge levels L0–L6', () => {
    for (let level = 0; level <= 6; level++) {
      const evalData: ClaudeMdEval = {
        level,
        levelLabel: `Level${level}`,
        rungs: [],
        nextSteps: [],
        inferred: false,
      }
      const { unmount } = render(
        <LevelBadgeCell evalData={evalData} repoName="test-repo" onClick={vi.fn()} />,
      )
      unmount()
    }
  })
})
