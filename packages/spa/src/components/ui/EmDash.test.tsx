/**
 * EmDash.test.tsx — `design-system` → A Value Is Shown Where One Exists.
 *
 * The requirement's second scenario asks for "a single canonical absence
 * marker … used consistently across every surface". The word doing the work is
 * *single*: four separate markers all rendering the same glyph satisfies the
 * eye and not the requirement, because nothing stops the fifth from differing.
 *
 * So the assertion is structural — no component may hard-code the character —
 * rather than a per-surface check that the right glyph appeared. The
 * per-surface behaviour is asserted where it belongs, in FleetPage.test.tsx and
 * RepoDetailPage.test.tsx.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { EmDash, EM_DASH } from './EmDash.js'

const UI_DIR = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(UI_DIR, '..')
const ROUTES_DIR = resolve(UI_DIR, '..', '..', 'routes')
const THIS_MODULE = resolve(UI_DIR, 'EmDash.tsx')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      out.push(...walk(p))
    } else if (
      ['.ts', '.tsx'].includes(extname(p)) &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx')
    ) {
      out.push(p)
    }
  }
  return out
}

/**
 * Quoted and JSX-text forms only — `'—'`, `"—"`, `` `—` ``, `>—<`.
 *
 * A bare character match would flag every prose comment in the codebase, which
 * uses spaced em dashes heavily. What matters is the character reaching the
 * DOM, and those four forms are how it gets there.
 */
const HARD_CODED = /(['"`])—\1|>—</

describe('EmDash — the single canonical absence marker', () => {
  it('renders the em dash character', () => {
    render(<EmDash />)
    expect(screen.getByText(EM_DASH)).toBeInTheDocument()
  })

  it('renders a marker rather than a blank, so absence is tellable from a failed render', () => {
    // The third scenario. An empty cell and a cell whose value did not load
    // look identical; a rendered glyph is the difference. Asserting the text
    // content is exactly the character also catches a regression to `''`,
    // which would still render an element and still tell the reader nothing.
    const { container } = render(<EmDash />)
    const marker = container.querySelector('span')
    expect(marker).not.toBeNull()
    expect(marker!.textContent).toBe(EM_DASH)
    expect(marker!.textContent!.trim()).not.toBe('')
  })

  it('EM_DASH is the em dash, not a hyphen or an en dash', () => {
    // U+2014. A hyphen-minus or an en dash would pass every "renders the
    // marker" test in this file while producing a different glyph on screen,
    // which is precisely the inconsistency the requirement forbids.
    expect(EM_DASH).toBe('—')
    expect(EM_DASH).not.toBe('-')
    expect(EM_DASH).not.toBe('–')
  })

  it('no other component hard-codes the character', () => {
    const files = [...walk(COMPONENTS_DIR), ...walk(ROUTES_DIR)].filter(
      (f) => f !== THIS_MODULE,
    )
    const offenders = files.filter((f) => HARD_CODED.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
