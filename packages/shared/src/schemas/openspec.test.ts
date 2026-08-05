/**
 * Wire shape for the single-project OpenSpec state — project-dashboard ›
 * Hybrid OpenSpec Read Strategy.
 *
 * `Schema Validation At Both Ends` binds this shape, so it is validated on the
 * daemon on the way out and in the browser on the way in. The tests below pin
 * the distinctions the surfaces depend on and that a looser schema would
 * silently erase:
 *
 *   - `hasTaskArtifact` is a value, not an inference from a zero count
 *   - the state carries no `archived` list and no per-change
 *     `affectedCapabilities`, both withdrawn by the v2 cutover
 */
import { describe, it, expect } from 'vitest'

import {
  OpenspecProjectStateSchema,
  OpenspecChangeDetailSchema,
  OpenspecCapabilitySchema,
} from './openspec.js'

const validState = {
  present: true,
  openChanges: [
    {
      name: 'add-thing',
      completedTasks: 2,
      totalTasks: 3,
      hasTaskArtifact: true,
    },
  ],
  capabilities: [{ id: 'daemon-runtime', requirementCount: 2 }],
}

describe('OpenspecProjectStateSchema', () => {
  it('accepts a fully populated state', () => {
    expect(OpenspecProjectStateSchema.parse(validState)).toEqual(validState)
  })

  it('accepts an absent openspec tree as present:false with empty collections', () => {
    const empty = { present: false, openChanges: [], capabilities: [] }
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
  it('keeps no-task-artifact distinct from zero of zero', () => {
    const absent = OpenspecChangeDetailSchema.parse({
      name: 'bare',
      completedTasks: 0,
      totalTasks: 0,
      hasTaskArtifact: false,
    })
    const emptyList = OpenspecChangeDetailSchema.parse({
      name: 'empty',
      completedTasks: 0,
      totalTasks: 0,
      hasTaskArtifact: true,
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
        ...validState,
        archived: [{ name: '2026-07-26-add-old', datePrefix: '2026-07-26' }],
      }),
    ).toThrow()
  })

  /*
   * Asserted on the accepted shape's key set rather than by expecting a throw.
   * A `.toThrow()` here passed for the wrong reason while `archived` was still
   * a required field — the parse rejected the payload for the missing key, not
   * for the extra one, and the case went green without the field ever having
   * been withdrawn.
   */
  it('carries no affected-capability list on an open change', () => {
    const parsed = OpenspecProjectStateSchema.parse(validState)
    expect(Object.keys(parsed.openChanges[0]!).sort()).toEqual([
      'completedTasks',
      'hasTaskArtifact',
      'name',
      'totalTasks',
    ])
  })

  it('rejects affectedCapabilities supplied on an open change', () => {
    expect(() =>
      OpenspecProjectStateSchema.parse({
        ...validState,
        openChanges: [{ ...validState.openChanges[0], affectedCapabilities: [] }],
      }),
    ).toThrow()
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
