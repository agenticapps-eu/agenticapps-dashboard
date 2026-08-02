/**
 * read.test.ts — what the project read route will accept.
 *
 * The allow-list used to live only in the daemon, which was fine while the
 * daemon was its only reader. The readiness detail changed that: it offers
 * evidence files to be opened, and the spec requires those offers to use
 * "repo-relative paths already accepted by that read route". A surface that
 * cannot see the allow-list cannot honour that, and would offer a control that
 * 422s — most visibly on `coverage/coverage-summary.json`, which is the default
 * evidence path for one of the six checks.
 */
import { describe, expect, it } from 'vitest'

import { ALLOWED_SUBDIRS, isReadableProjectPath } from './read.js'

describe('isReadableProjectPath', () => {
  it('accepts a file inside each allowed subdirectory', () => {
    expect(isReadableProjectPath('openspec/changes/add-repo-readiness/REVIEWS.md')).toBe(true)
    expect(isReadableProjectPath('.claude/skills/agentic-apps-workflow/skill/SKILL.md')).toBe(true)
    expect(isReadableProjectPath('.planning/skill-observations/x.json')).toBe(true)
  })

  it('rejects the evidence paths the read route has never served', () => {
    // Both are real: the coverage check defaults to the first, and a repo may
    // declare the second in its readiness file.
    expect(isReadableProjectPath('coverage/coverage-summary.json')).toBe(false)
    expect(isReadableProjectPath('bin/openspec-change-gate.sh')).toBe(false)
    expect(isReadableProjectPath('REVIEW.md')).toBe(false)
    expect(isReadableProjectPath('.agenticapps/readiness.json')).toBe(false)
  })

  it('rejects what the daemon rejects before it ever reaches the daemon', () => {
    expect(isReadableProjectPath('/etc/passwd')).toBe(false)
    expect(isReadableProjectPath('openspec/../.git/config')).toBe(false)
    expect(isReadableProjectPath('..')).toBe(false)
    expect(isReadableProjectPath('')).toBe(false)
  })

  it('does not accept a sibling whose name merely starts with an allowed one', () => {
    expect(isReadableProjectPath('openspec-notes/leak.md')).toBe(false)
    expect(isReadableProjectPath('openspec')).toBe(false)
  })

  it('states the three directories the daemon actually allows', () => {
    // Pinned so the two copies cannot drift apart silently. The daemon imports
    // this constant rather than keeping its own.
    expect([...ALLOWED_SUBDIRS]).toEqual(['.planning', '.claude', 'openspec'])
  })
})
