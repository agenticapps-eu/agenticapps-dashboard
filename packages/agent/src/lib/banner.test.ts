import { describe, it, expect } from 'vitest'

import { renderBanner, renderZeroBindWarning } from './banner.js'

const SAMPLE_TOKEN = '8a3f-c9d2-1b47-e8f0-4a7c-9b1e-2d8a-6f93'
const PROD_ORIGIN = 'https://agenticapps-dashboard.pages.dev'

describe('renderBanner', () => {
  it('contains all 8 spec banner lines verbatim', () => {
    const result = renderBanner({
      bindUrl: 'http://127.0.0.1:5193',
      token: SAMPLE_TOKEN,
      registryCount: 3,
      projectNames: ['acme-app', 'beta-app', 'agentic-apps-workflow'],
      pairHostname: '127.0.0.1:5193',
    })

    expect(result).toContain('[agent] Daemon starting…')
    expect(result).toContain('[agent] Registry: 3 projects (acme-app, beta-app, agentic-apps-workflow)')
    expect(result).toContain('[agent] Listening on http://127.0.0.1:5193')
    expect(result).toContain(`[agent] Token: ${SAMPLE_TOKEN}`)
    expect(result).toContain('[agent] Pair this device:')
    expect(result).toContain('[agent] Or pair manually at https://agenticapps-dashboard.pages.dev/settings:')
    expect(result).toContain('[agent]   Agent URL: http://127.0.0.1:5193')
    expect(result).toContain(`[agent]   Token:     ${SAMPLE_TOKEN}`)
  })

  it('banner contains literal "Press Ctrl-C to stop" closer', () => {
    const result = renderBanner({
      bindUrl: 'http://127.0.0.1:5193',
      token: SAMPLE_TOKEN,
      registryCount: 1,
      projectNames: ['acme-app'],
      pairHostname: '127.0.0.1:5193',
    })
    expect(result).toContain(
      '[agent] Press Ctrl-C to stop, or `agentic-dashboard install-launchd` to run as a service.',
    )
  })

  it('banner contains literal "Or pair manually at" line with correct URL', () => {
    const result = renderBanner({
      bindUrl: 'http://127.0.0.1:5193',
      token: SAMPLE_TOKEN,
      registryCount: 1,
      projectNames: ['acme-app'],
      pairHostname: '127.0.0.1:5193',
    })
    expect(result).toContain(
      `[agent] Or pair manually at ${PROD_ORIGIN}/settings:`,
    )
  })

  it('pair URL uses URL-encoded agent param (%3A%2F%2F)', () => {
    const result = renderBanner({
      bindUrl: 'http://127.0.0.1:5193',
      token: SAMPLE_TOKEN,
      registryCount: 1,
      projectNames: ['acme-app'],
      pairHostname: '127.0.0.1:5193',
    })
    // encodeURIComponent('http://127.0.0.1:5193') = 'http%3A%2F%2F127.0.0.1%3A5193'
    expect(result).toContain(`?agent=http%3A%2F%2F127.0.0.1%3A5193&token=`)
  })

  it('empty registry: banner says "Registry: 0 projects" with no project names', () => {
    const result = renderBanner({
      bindUrl: 'http://127.0.0.1:5193',
      token: SAMPLE_TOKEN,
      registryCount: 0,
      projectNames: [],
      pairHostname: '127.0.0.1:5193',
    })
    expect(result).toContain('[agent] Registry: 0 projects')
    expect(result).not.toContain('(')
  })
})

describe('renderZeroBindWarning', () => {
  it('returns yellow ANSI-coded string with exact spec text', () => {
    const result = renderZeroBindWarning()
    expect(result).toContain(
      'WARNING: bound to 0.0.0.0 — only safe on Tailscale-isolated machines. CIDR enforcement is ON.',
    )
  })
})
