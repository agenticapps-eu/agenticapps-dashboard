/**
 * Per-Project Computed Status — project-registry.
 *
 * The marker matrix applies only to a reachable root. Reachability takes
 * precedence: an unreachable project reads as both markers absent, so without
 * that precedence an unmounted volume renders as `no-workflow` and the card
 * tells the user to install a workflow into a path the daemon cannot see.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, afterEach } from 'vitest'

import { computeProjectCondition } from './projectCondition.js'

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'cond-'))
  cleanups.push(() => rmSync(d, { recursive: true, force: true }))
  return d
}

function withSkill(root: string): string {
  mkdirSync(join(root, '.claude', 'skills', 'agentic-apps-workflow'), { recursive: true })
  writeFileSync(join(root, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), '# skill')
  return root
}

function withOpenspec(root: string): string {
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true })
  return root
}

describe('computeProjectCondition', () => {
  it('reports migrated when openspec/ is present', () => {
    expect(computeProjectCondition(withOpenspec(tmp()), true)).toBe('migrated')
  })

  it('reports migrated even when a .planning tree is also present', () => {
    const root = withOpenspec(withSkill(tmp()))
    mkdirSync(join(root, '.planning', 'phases', '01-thing'), { recursive: true })
    expect(computeProjectCondition(root, true)).toBe('migrated')
  })

  it('reports needs-migration for the workflow skill without openspec/', () => {
    expect(computeProjectCondition(withSkill(tmp()), true)).toBe('needs-migration')
  })

  it('reports no-workflow when neither marker is present', () => {
    expect(computeProjectCondition(tmp(), true)).toBe('no-workflow')
  })

  it('reports unreachable regardless of markers when the root is unreachable', () => {
    expect(computeProjectCondition(withOpenspec(tmp()), false)).toBe('unreachable')
    expect(computeProjectCondition(withSkill(tmp()), false)).toBe('unreachable')
    expect(computeProjectCondition('/nonexistent-root-xyz', false)).toBe('unreachable')
  })

  it('does not report no-workflow for a root that simply does not exist', () => {
    expect(computeProjectCondition('/nonexistent-root-xyz', false)).not.toBe('no-workflow')
  })
})
