/**
 * screenshot.mjs — One-shot Playwright visual smoke script.
 *
 * Usage:
 *   npx --package=playwright -- node packages/spa/scripts/screenshot.mjs
 *
 * Env overrides:
 *   SCREENSHOT_URL  — default: http://localhost:5174/projects/agenticapps-dashboard
 *   SCREENSHOT_OUT  — default: .planning/phases/DASH-05.1-.../refs/after-shell.png
 *
 * Phase 5.1 Wave 5 — captures AppShellV2 at 1440x900 for visual smoke gate.
 * See: .planning/phases/DASH-05.1.../05.1-RESEARCH.md "Visual Smoke Test Strategy"
 */
import { chromium } from 'playwright'

const URL = process.env.SCREENSHOT_URL || 'http://localhost:5174/projects/agenticapps-dashboard'
const OUT = process.env.SCREENSHOT_OUT || '.planning/phases/DASH-05.1-ui-redesign-cloudflare-inspired-sidebar-dashboard-shell/refs/after-shell.png'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.screenshot({ path: OUT, fullPage: false })
await browser.close()
console.log(`Screenshot written to ${OUT}`)
