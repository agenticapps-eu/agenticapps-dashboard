import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { OpenspecProjectState } from '../openspecReader.js'

import { deriveSpec } from './specDeriver.js'

const NOW = Date.parse('2026-07-31T12:00:00Z')

const state = (over: Partial<OpenspecProjectState> = {}): OpenspecProjectState => ({
  present: true,
  openChanges: [],
  capabilities: [],
  ...over,
})

const change = (name: string, completedTasks: number, totalTasks: number) => ({
  name,
  completedTasks,
  totalTasks,
  hasTaskArtifact: true,
})

const derive = (readProject: () => Promise<OpenspecProjectState>) =>
  deriveSpec({ root: '/somewhere/a-repo', now: NOW, readProject })

describe('deriveSpec', () => {
  it('reports never when the reader finds no spec slot', async () => {
    const result = await derive(async () => state({ present: false }))
    expect(result.status).toBe('never')
    expect(result.at).toBeNull()
    expect(result.evidence).toBeNull()
    expect(result.error).toBeNull()
    expect(result.summary).toMatch(/openspec/i)
  })

  it('reports ok when the spec slot exists with no open changes', async () => {
    const result = await derive(async () => state())
    expect(result.status).toBe('ok')
    expect(result.value).toBe(0)
    expect(result.at).toBe(NOW)
  })

  it('reports warn with the count and task ratios when changes are open', async () => {
    const result = await derive(async () =>
      state({ openChanges: [change('add-repo-readiness', 27, 97), change('add-oss-readiness', 0, 23)] }),
    )
    expect(result.status).toBe('warn')
    expect(result.value).toBe(2)
    expect(result.summary).toContain('add-repo-readiness')
    expect(result.summary).toContain('27/97')
    expect(result.summary).toContain('0/23')
  })

  it('keeps its summary within the wire shape bound when many changes are open', async () => {
    const many = Array.from({ length: 40 }, (_, i) => change(`change-number-${i}`, i, 100))
    const result = await derive(async () => state({ openChanges: many }))
    expect(result.summary.length).toBeLessThanOrEqual(600)
    expect(result.value).toBe(40)
  })

  it('reports an error-bearing fail when the reader throws', async () => {
    const result = await derive(async () => {
      throw new Error('EACCES: permission denied, scandir /Users/someone/a-repo/openspec')
    })
    expect(result.status).toBe('fail')
    expect(result.error?.code).toBeTruthy()
    expect(result.error?.message).not.toContain('/Users/someone')
    expect(result.summary).not.toContain('/Users/someone')
  })

  it('consults no phase tree — an unmigrated repo stays never', async () => {
    const result = await derive(async () => state({ present: false }))
    expect(result.status).toBe('never')
    expect(result.value).toBeNull()
  })
})

/**
 * The requirement is that this check maps what the existing reader reports and
 * never traverses a project's spec directory itself. A grep over its own source
 * is the check that keeps that true as the file changes.
 */
describe('specDeriver source', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./specDeriver.ts', import.meta.url)),
    'utf8',
  )

  it('carries no spec-directory path literal of its own', () => {
    expect(source).not.toMatch(/['"`][^'"`]*openspec\//)
  })

  it('imports no filesystem module', () => {
    expect(source).not.toMatch(/from 'node:fs/)
  })
})
