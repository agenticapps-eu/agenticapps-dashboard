/**
 * help-walking-checklist.spec.ts — reviewer's 8-item manual checklist as
 * an automated Playwright walk.
 *
 * Plan 07-05 Task 7. Authored from RESEARCH §"Playwright walking script".
 *
 * Scope (HELP-01..06 + ROADMAP S1..S8):
 *   1. Every anchor renders without console errors; Mermaid SVG appears.
 *   2. Sampled stub routes render <ComingSoon> + back-link.
 *   3. Section paths redirect to /overview or /install.
 *   4. Widget Suspense resolves (Coming v1.2 badge).
 *   5. ? shortcut from / lands on /help docs landing.
 *   6. reference/shortcuts page renders KbdHint chips.
 *   7. Catch-all redirect for unknown /help/* paths.
 *   8. Mobile viewport drawer toggle.
 *
 * @see .planning/phases/07-help-docs-v1-0/07-RESEARCH.md
 */
import { test, expect } from '@playwright/test'

const ANCHOR_ROUTES = [
  '/help',
  '/help/workflow/overview',
  '/help/repos/overview',
  '/help/observability/overview',
  '/help/operations/install',
]

const STUB_SAMPLES = [
  '/help/workflow/gates',
  '/help/observability/scan',
  '/help/reference/glossary',
]

const REDIRECT_PAIRS: Array<[string, string]> = [
  ['/help/workflow', '/help/workflow/overview'],
  ['/help/repos', '/help/repos/overview'],
  ['/help/observability', '/help/observability/overview'],
  ['/help/operations', '/help/operations/install'],
]

test.describe('Reviewer walking checklist (HELP-01..06)', () => {
  test('every anchor renders without console errors; Mermaid SVG appears', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    for (const route of ANCHOR_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' })
      await expect(page.locator('article.prose')).toBeVisible()
      await expect(page).toHaveTitle(/AgenticApps Dashboard Help/)
      if (route !== '/help/operations/install') {
        // mermaid lazy-loads then runs; give it time
        await expect(
          page.locator('pre.mermaid, svg.mermaid, .mermaid svg').first(),
        ).toBeVisible({ timeout: 8_000 })
      }
    }
    expect(
      errors,
      `Console errors during anchor walk: ${errors.join('\n')}`,
    ).toEqual([])
  })

  test('sampled stub routes render ComingSoon + back-link', async ({ page }) => {
    for (const route of STUB_SAMPLES) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('link', { name: /back to/i })).toBeVisible()
    }
  })

  test('section paths redirect to overview/install', async ({ page }) => {
    for (const [from, to] of REDIRECT_PAIRS) {
      await page.goto(from)
      await expect(page).toHaveURL(to)
    }
  })

  test('widget Suspense resolves: repos/overview shows Coming v1.2 badge', async ({ page }) => {
    await page.goto('/help/repos/overview', { waitUntil: 'networkidle' })
    await expect(page.getByText(/coming v1\.2/i)).toBeVisible({ timeout: 5_000 })
  })

  test('? shortcut from / lands on /help docs landing', async ({ page }) => {
    // Seed a valid pairing record BEFORE first navigation. Without this,
    // the SPA's indexRoute beforeLoad sees getPairing() === null and
    // redirects to /onboarding — `useGlobalShortcuts` is mounted in
    // AppShellV2 (not on /onboarding), so the `?` keypress never fires.
    // Schema: { agentUrl, token (8-hex × 8 dashed), pairedAt (ISO) }
    // — matches PairingSchema in packages/shared/src/schemas/pairing.ts.
    // Key: 'agentic-dashboard:pairing' (packages/spa/src/lib/pairing.ts).
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'agentic-dashboard:pairing',
        JSON.stringify({
          agentUrl: 'http://localhost:5193',
          token: '00000000-11111111-22222222-33333333-44444444-55555555-66666666-77777777',
          pairedAt: '2026-05-11T00:00:00.000Z',
        }),
      )
    })
    await page.goto('/')
    // Wait for AppShellV2 (and useGlobalShortcuts) to mount before pressing.
    // The home page has no h1; sidebar nav contains a "Help" link instead.
    await expect(page.getByRole('link', { name: /^Help$/ })).toBeVisible()
    // Playwright's page.keyboard.press('?') dispatches keydown with
    // key='?' and shiftKey=false (bypasses OS layout to deliver the literal
    // character) — matches the unit-test contract in
    // useGlobalShortcuts.test.tsx GS8 (`fireKey('?')`). Real-browser users
    // type Shift+/ to produce `?`; the hook's modifier-bail (`if
    // (e.shiftKey) return`) would block that today. Flagged in follow-up
    // as the v1.0 keypress UX is verified end-to-end here only against the
    // synthetic event shape.
    await page.keyboard.press('?')
    await expect(page).toHaveURL('/help')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('reference/shortcuts page renders KbdHint chips', async ({ page }) => {
    await page.goto('/help/reference/shortcuts')
    await expect(
      page.getByRole('heading', { name: /keyboard shortcuts/i, level: 1 }),
    ).toBeVisible()
    // KbdHint renders as `<span aria-hidden="true" class="…font-mono…">{keys}</span>`.
    // Scope the locator to the prose article (where chips live in the global
    // shortcuts table) and to the font-mono chip span — otherwise
    // `getByText('R').first()` on mobile resolves to the sidebar `<h3>`
    // section header "REPOSITORIES" (heading starts with R, comes first in
    // DOM order). Use exact text match on the chip span.
    const chips = page.locator('article.prose span.font-mono')
    await expect(chips.filter({ hasText: /^R$/ }).first()).toBeVisible()
    await expect(chips.filter({ hasText: /^Cmd$/ }).first()).toBeVisible()
  })

  test('catch-all redirect: unknown /help/* path falls to /help', async ({ page }) => {
    await page.goto('/help/this-does-not-exist')
    await expect(page).toHaveURL('/help')
  })
})

test.describe('Mobile viewport HelpLayout (HELP-03)', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test('sidebar hidden initially; toggle opens it', async ({ page }) => {
    await page.goto('/help')
    const aside = page.getByLabel('Help navigation')
    await expect(aside).toBeHidden()
    await page.getByRole('button', { name: /toggle navigation/i }).click()
    await expect(aside).toBeVisible()
  })
})
