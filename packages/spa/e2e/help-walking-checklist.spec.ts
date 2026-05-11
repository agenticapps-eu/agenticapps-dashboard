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
    // Skip if not paired — for the dev session we assume the test runs against a paired SPA.
    await page.goto('/')
    await page.keyboard.press('?')
    await expect(page).toHaveURL('/help')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('reference/shortcuts page renders KbdHint chips', async ({ page }) => {
    await page.goto('/help/reference/shortcuts')
    await expect(
      page.getByRole('heading', { name: /keyboard shortcuts/i, level: 1 }),
    ).toBeVisible()
    // KbdHint chips render their keys as plain text inside <span aria-hidden>
    await expect(page.getByText('R').first()).toBeVisible()
    await expect(page.getByText('Cmd').first()).toBeVisible()
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
