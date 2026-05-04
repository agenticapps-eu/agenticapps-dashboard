import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * WR-03 regression: Cloudflare Pages `_headers` ships the CSP that gates the
 * SPA's outbound connections to the local daemon. The daemon's CLI exposes
 * `--port <number>`, so the CSP `connect-src` MUST allow any port on loopback
 * and on `*.ts.net` — otherwise a user who started the daemon with a custom
 * port would pass `AgentUrlSchema` validation, write a pairing record, and
 * then watch every `apiFetch` get silently blocked by CSP in production.
 *
 * NOTE: This is the SPA-side CSP — it is NOT the daemon-side CORS lock.
 * CLAUDE.md's "CORS locked to https://dashboard.agenticapps.eu and
 * http://localhost:5174" is about the daemon's CORS, not this CSP.
 */
describe('public/_headers — CSP connect-src allows any port (WR-03)', () => {
  const headersPath = resolve(__dirname, '../../public/_headers')
  const headers = readFileSync(headersPath, 'utf-8')

  it('CSP connect-src allows http://localhost:* (any port)', () => {
    expect(headers).toMatch(/connect-src[^;]*\bhttp:\/\/localhost:\*/)
  })

  it('CSP connect-src allows http://127.0.0.1:* (any port)', () => {
    expect(headers).toMatch(/connect-src[^;]*\bhttp:\/\/127\.0\.0\.1:\*/)
  })

  it('CSP connect-src allows https://*.ts.net:* (any port)', () => {
    expect(headers).toMatch(/connect-src[^;]*https:\/\/\*\.ts\.net:\*/)
  })

  it('CSP connect-src allows http://*.ts.net:* (any port)', () => {
    expect(headers).toMatch(/connect-src[^;]*http:\/\/\*\.ts\.net:\*/)
  })

  it('CSP connect-src does NOT pin loopback to literal port 5193', () => {
    // Future edits must not re-tighten back to a specific port — that would
    // silently break users running `agentic-dashboard start --port <other>`.
    expect(headers).not.toMatch(/connect-src[^;]*http:\/\/localhost:5193(?!\*)/)
    expect(headers).not.toMatch(/connect-src[^;]*http:\/\/127\.0\.0\.1:5193(?!\*)/)
  })
})
