/**
 * Test scaffold for wikiScanner.ts — .wiki-compiler.json source-reference + .compile-state.json freshness.
 * Plan 02 implements; Plan 01 provides the it.todo placeholders.
 *
 * AGREED-1: exact-match-or-prefix-with-slash predicate:
 *   s.path === repoName || s.path.startsWith(repoName + '/')
 *   e.g. 'app' matches source 'app' and 'app/sub' but NOT 'app-worker'.
 */

import { describe, it } from 'vitest'

describe('scanWiki', () => {
  it.todo("returns state=missing with label='wiki not linked' when .wiki-compiler.json is absent")
  it.todo("returns state=missing with label='repo not in sources' when config exists but no source matches the repo")
  it.todo(
    "EXACT-MATCH-OR-PREFIX-WITH-SLASH predicate (AGREED-1): s.path === repoName || s.path.startsWith(repoName + '/') — 'app' matches 'app' and 'app/sub' but NOT 'app-worker'"
  )
  it.todo(
    "returns state=stale with label='never compiled' when config has repo source but .compile-state.json is absent"
  )
  it.todo('returns state=fresh when compile-state.json mtime ≤ 7 days ago')
  it.todo('returns state=stale when compile-state.json mtime > 7 days ago')
  it.todo("returns state=stale with label='compile-state.json invalid' when state file is malformed JSON")
})
