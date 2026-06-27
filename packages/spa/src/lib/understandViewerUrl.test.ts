/**
 * understandViewerUrl.test.ts — unit tests for the shared viewer URL helper
 * (Phase 14 review fix — Bundle D dedup).
 */
import { describe, it, expect } from 'vitest'

import { buildViewerUrl } from './understandViewerUrl.js'

describe('buildViewerUrl', () => {
  it('builds the D-14-07 URL shape: {agentUrl}/understand/{family}/{repo}/?token=…', () => {
    expect(
      buildViewerUrl('http://127.0.0.1:5193', 'agenticapps', 'claude-workflow', 'v1.abc.def'),
    ).toBe('http://127.0.0.1:5193/understand/agenticapps/claude-workflow/?token=v1.abc.def')
  })

  it('URI-encodes the viewer token', () => {
    const url = buildViewerUrl('http://127.0.0.1:5193', 'agenticapps', 'repo', 'a+b/c&d=e')
    expect(url).toContain(`?token=${encodeURIComponent('a+b/c&d=e')}`)
    expect(url).not.toContain('?token=a+b/c&d=e')
  })

  it('URI-encodes family and repo path segments', () => {
    const url = buildViewerUrl('http://127.0.0.1:5193', 'fam ily', 'repo/../evil', 'tok')
    expect(url).toBe(
      `http://127.0.0.1:5193/understand/${encodeURIComponent('fam ily')}/${encodeURIComponent('repo/../evil')}/?token=tok`,
    )
    // No raw traversal sequence survives in the path
    expect(url).not.toContain('/../')
  })

  it('valid lowercase ids pass through unchanged (encoding is a no-op)', () => {
    expect(buildViewerUrl('https://host.ts.net:5193', 'neuroflash', 'neuroflash-api_2.0', 't')).toBe(
      'https://host.ts.net:5193/understand/neuroflash/neuroflash-api_2.0/?token=t',
    )
  })
})
