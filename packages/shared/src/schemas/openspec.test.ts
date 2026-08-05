/**
 * Wire shape for the single-project OpenSpec state — project-dashboard ›
 * Change Progress Column + Capability Panel.
 *
 * `Schema Validation At Both Ends` binds this shape, so it is validated on the
 * daemon on the way out and in the browser on the way in. The tests below pin
 * the three distinctions the surfaces depend on and that a looser schema would
 * silently erase:
 *
 *   - `hasTaskArtifact` is a value, not an inference from a zero count
 *   - `affectedCapabilities` may be empty — a change with no spec delta yet
 *   - `datePrefix` may be null — an archive name carrying no chronological claim
 */
import { describe, it, expect } from 'vitest'

import {
  OpenspecProjectStateSchema,
  OpenspecChangeDetailSchema,
  OpenspecCapabilitySchema,
  OpenspecArchivedChangeSchema,
} from './openspec.js'

const validState = {
  present: true,
  openChanges: [
    {
      name: 'add-thing',
      completedTasks: 2,
      totalTasks: 3,
      hasTaskArtifact: true,
      affectedCapabilities: ['daemon-runtime', 'help-docs'],
    },
  ],
  capabilities: [{ id: 'daemon-runtime', requirementCount: 2 }],
  archived: [{ name: '2026-07-26-add-old', datePrefix: '2026-07-26' }],
}

describe('OpenspecProjectStateSchema', () => {
  it('accepts a fully populated state', () => {
    expect(OpenspecProjectStateSchema.parse(validState)).toEqual(validState)
  })

  it('accepts an absent openspec tree as present:false with empty collections', () => {
    const empty = { present: false, openChanges: [], capabilities: [], archived: [] }
    expect(OpenspecProjectStateSchema.parse(empty)).toEqual(empty)
  })

  it('rejects unknown keys rather than stripping them', () => {
    // Strict, following the registry and overview precedent set in groups 4/5:
    // a silently stripped key is a schema drift the panel never sees.
    expect(() =>
      OpenspecProjectStateSchema.parse({ ...validState, phase: 'legacy' }),
    ).toThrow()
  })

  it('requires every field — a partial state is not a valid state', () => {
    expect(() => OpenspecProjectStateSchema.parse({ present: true })).toThrow()
  })
})

describe('OpenspecChangeDetailSchema', () => {
  it('carries affected capabilities alongside the card summary fields', () => {
    const c = validState.openChanges[0]
    expect(OpenspecChangeDetailSchema.parse(c).affectedCapabilities).toEqual([
      'daemon-runtime',
      'help-docs',
    ])
  })

  it('accepts an empty affectedCapabilities — a change with no spec delta yet', () => {
    const c = { ...validState.openChanges[0], affectedCapabilities: [] }
    expect(OpenspecChangeDetailSchema.parse(c).affectedCapabilities).toEqual([])
  })

  it('keeps no-task-artifact distinct from zero of zero', () => {
    const absent = OpenspecChangeDetailSchema.parse({
      name: 'bare',
      completedTasks: 0,
      totalTasks: 0,
      hasTaskArtifact: false,
      affectedCapabilities: [],
    })
    const emptyList = OpenspecChangeDetailSchema.parse({
      name: 'empty',
      completedTasks: 0,
      totalTasks: 0,
      hasTaskArtifact: true,
      affectedCapabilities: [],
    })
    expect(absent.hasTaskArtifact).toBe(false)
    expect(emptyList.hasTaskArtifact).toBe(true)
  })

  it('rejects negative counts', () => {
    expect(() =>
      OpenspecChangeDetailSchema.parse({
        name: 'x',
        completedTasks: -1,
        totalTasks: 0,
        hasTaskArtifact: true,
        affectedCapabilities: [],
      }),
    ).toThrow()
  })
})

/*
 * `Hybrid OpenSpec Read Strategy` states after the v2 cutover that the reader
 * SHALL NOT enumerate archived changes or derive affected capabilities. The
 * wire shape has to enforce that, not merely stop populating it: with a strict
 * schema, a daemon that kept emitting either field fails its own outbound
 * validation instead of shipping a payload no consumer reads.
 */
describe('the wire shape carries no withdrawn field', () => {
  it('rejects an archived list on the project state', () => {
    expect(() =>
      OpenspecProjectStateSchema.parse({
        present: true,
        openChanges: [],
        capabilities: [],
        archived: [{ name: '2026-07-26-add-old', datePrefix: '2026-07-26' }],
      }),
    ).toThrow()
  })

  /*
   * Asserted on the accepted shape's key set rather than by expecting a throw.
   * A `.toThrow()` here would pass for the wrong reason while `archived` is
   * still a required field — the parse rejects the payload for the missing
   * key, not for the extra one, and the test would go green without the field
   * ever having been withdrawn.
   */
  it('carries no affected-capability list on an open change', () => {
    const parsed = OpenspecProjectStateSchema.parse({
      present: true,
      openChanges: [
        { name: 'add-thing', completedTasks: 2, totalTasks: 3, hasTaskArtifact: true },
      ],
      capabilities: [],
    })
    expect(Object.keys(parsed.openChanges[0]).sort()).toEqual([
      'completedTasks',
      'hasTaskArtifact',
      'name',
      'totalTasks',
    ])
  })
})

describe('OpenspecCapabilitySchema', () => {
  it('accepts a capability declaring zero requirements', () => {
    expect(OpenspecCapabilitySchema.parse({ id: 'new-thing', requirementCount: 0 })).toEqual({
      id: 'new-thing',
      requirementCount: 0,
    })
  })

  it('rejects an empty capability id', () => {
    expect(() => OpenspecCapabilitySchema.parse({ id: '', requirementCount: 1 })).toThrow()
  })
})

describe('OpenspecArchivedChangeSchema', () => {
  it('accepts a null datePrefix — the name carries no chronological claim', () => {
    expect(OpenspecArchivedChangeSchema.parse({ name: 'legacy', datePrefix: null })).toEqual({
      name: 'legacy',
      datePrefix: null,
    })
  })

  it('requires datePrefix to be present, even when null', () => {
    expect(() => OpenspecArchivedChangeSchema.parse({ name: 'legacy' })).toThrow()
  })
})
