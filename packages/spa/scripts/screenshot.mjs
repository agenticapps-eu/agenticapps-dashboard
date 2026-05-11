/**
 * screenshot.mjs — Parameterized Playwright visual capture script.
 *
 * Usage:
 *   npx --package=playwright -- node packages/spa/scripts/screenshot.mjs [flags]
 *
 * Flags:
 *   --route <path>        Route path (default: /projects/agenticapps-dashboard)
 *   --viewport <WxH>      Viewport dimensions (default: 1440x900)
 *   --out <filepath>      Output path for the PNG (default: see below)
 *   --base-url <url>      Base URL of the running SPA (default: http://localhost:5174)
 *
 * Env overrides (take priority over flag defaults; flags take priority over env defaults):
 *   SCREENSHOT_URL  — full URL override (base-url + route); wins over --base-url + --route
 *   SCREENSHOT_OUT  — output path override; wins over --out
 *
 * Phase 6 Plan 01 — extended from Phase 5.1 Wave 5 to accept route + viewport flags.
 * See: .planning/phases/06-polish-service-install-acceptance/06-01-PLAN.md
 */

/**
 * Parse a viewport string of the form "WxH" into { width, height }.
 * Throws with a clear message on invalid input.
 *
 * @param {string} s - e.g. "1440x900"
 * @returns {{ width: number, height: number }}
 */
export function parseViewport(s) {
  const m = /^(\d+)x(\d+)$/.exec(s)
  if (!m) throw new Error(`Invalid --viewport: ${s} (expected WxH e.g. 1440x900)`)
  return { width: Number(m[1]), height: Number(m[2]) }
}

/**
 * Capture a screenshot of the given route and write it to disk.
 *
 * @param {{ route: string, viewport: string, out: string, baseUrl: string }} opts
 * @returns {Promise<string>} The path written.
 */
export async function captureScreenshot({ route, viewport, out, baseUrl }) {
  if (!route.startsWith('/')) {
    console.error(`Error: --route must start with /  (got: ${route})`)
    process.exit(2)
  }

  const { chromium } = await import('playwright')
  const { width, height } = parseViewport(viewport)
  const url = `${baseUrl}${route}`

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.screenshot({ path: out, fullPage: false })
  } finally {
    await browser.close()
  }

  console.log(`Screenshot written to ${out}`)
  return out
}

// ---------------------------------------------------------------------------
// Top-level run — only executes when this file is the entry point.
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse argv flags (manual parsing — no minimist/yargs/commander per INV-05)
  const argv = process.argv.slice(2)

  let flagRoute = null
  let flagViewport = null
  let flagOut = null
  let flagBaseUrl = null

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--route' && i + 1 < argv.length) { flagRoute = argv[++i] }
    else if (a === '--viewport' && i + 1 < argv.length) { flagViewport = argv[++i] }
    else if (a === '--out' && i + 1 < argv.length) { flagOut = argv[++i] }
    else if (a === '--base-url' && i + 1 < argv.length) { flagBaseUrl = argv[++i] }
  }

  // Env wins over flag default; flag wins over env default.
  // SCREENSHOT_URL (if set) is a full URL that overrides base-url + route.
  const envUrl = process.env.SCREENSHOT_URL
  const envOut = process.env.SCREENSHOT_OUT

  // Resolve baseUrl and route
  let baseUrl
  let route
  if (envUrl) {
    // Full URL from env — split into baseUrl + route
    try {
      const parsed = new URL(envUrl)
      baseUrl = `${parsed.protocol}//${parsed.host}`
      route = parsed.pathname + (parsed.search || '')
    } catch {
      // Treat as opaque; pass raw as base-url with / route
      baseUrl = envUrl
      route = '/'
    }
  } else {
    baseUrl = flagBaseUrl ?? 'http://localhost:5174'
    route = flagRoute ?? '/projects/agenticapps-dashboard'
  }

  const out = envOut ?? flagOut ?? '.planning/phases/DASH-05.1-ui-redesign-cloudflare-inspired-sidebar-dashboard-shell/refs/after-shell.png'
  const viewport = flagViewport ?? '1440x900'

  // Validate route before launching Playwright
  if (!route.startsWith('/')) {
    console.error(`Error: --route must start with /  (got: ${route})`)
    process.exit(2)
  }

  await captureScreenshot({ route, viewport, out, baseUrl })
}
