/**
 * Plan 07-02 Task 1 — topicToUrl pure function.
 *
 * Extracts the URL builder from HelpHook so it can be table-driven tested
 * without rendering. Source: ~/Documents/.../HelpHook.tsx lines 74-81.
 */
import { describe, it, expect } from 'vitest'

import { topicToUrl } from './topicToUrl'

describe('topicToUrl', () => {
  it.each([
    ['workflow.gates', '/help/workflow/gates'],
    ['repos.core', '/help/repos/core'],
    ['observability.scan', '/help/observability/scan'],
    ['observability.scan#high-confidence', '/help/observability/scan#high-confidence'],
    ['workflow', '/help/workflow'],
    ['a.b.c.d', '/help/a/b/c/d'],
    ['a.b#anchor.with.dots', '/help/a/b#anchor.with.dots'],
    ['reference.shortcuts', '/help/reference/shortcuts'],
    ['', '/help/'],
  ])('topicToUrl(%j) === %j', (topic, expected) => {
    expect(topicToUrl(topic)).toBe(expected)
  })
})
