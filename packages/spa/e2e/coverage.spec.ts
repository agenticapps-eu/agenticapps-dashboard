/**
 * coverage.spec.ts — Playwright e2e for the /coverage user journey.
 *
 * Plan 10-07 Task 3.
 *
 * CODEX MED-16: This spec is explicitly local-only. In CI the suite is skipped;
 * CoverageUserJourney.test.tsx provides the deterministic CI-safe coverage.
 *
 * Scenarios (UI-SPEC §11 enumeration):
 *   1. cold-load: matrix renders 3 family sections
 *   2. filter chip click — selecting "missing" reflects in URL
 *   3. search input — typing "agent" updates URL with q=agent
 *   4. override chip — expand/collapse (conditional: skipped when no sentinels)
 *   5. keyboard navigation — Tab through page-header → toolbar → first section
 *   6. desktop and smallest-breakpoint layouts expose only current columns
 *
 * @see .planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/10-REVIEWS.md CODEX MED-16
 */
import { test, expect } from '@playwright/test'

// CODEX MED-16 LOCAL-ONLY GATE
// Playwright spec requires a running daemon (/api/coverage endpoint).
// CI uses the deterministic mocked test (CoverageUserJourney.test.tsx) instead.
const LOCAL_ONLY = process.env.CI !== 'true'

test.describe('/coverage user journey', () => {
  test.skip(!LOCAL_ONLY, 'Playwright spec is local-only; CI relies on CoverageUserJourney.test.tsx for coverage (CODEX MED-16)')

  test.beforeEach(async ({ page }) => {
    // Seed a valid pairing record so indexRoute's beforeLoad doesn't redirect to /onboarding.
    // Schema: { agentUrl, token (8-hex × 8 dashed), pairedAt (ISO) }
    // Key: 'agentic-dashboard:pairing' (packages/spa/src/lib/pairing.ts)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'agentic-dashboard:pairing',
        JSON.stringify({
          agentUrl: 'http://127.0.0.1:5193',
          token: '00000000-11111111-22222222-33333333-44444444-55555555-66666666-77777777',
          pairedAt: new Date().toISOString(),
        }),
      )
    })
  })

  test('cold-load: matrix renders 3 family sections', async ({ page }) => {
    await page.goto('/coverage')
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()
    await expect(page.getByText('agenticapps')).toBeVisible()
    await expect(page.getByText('factiv')).toBeVisible()
    await expect(page.getByText('neuroflash')).toBeVisible()
  })

  test('filter chip click — selecting "missing" reflects in URL (?status=missing)', async ({ page }) => {
    await page.goto('/coverage')
    // Wait for toolbar to render (data loaded)
    await expect(page.getByRole('button', { name: /missing/i })).toBeVisible()
    await page.getByRole('button', { name: /missing/i }).click()
    // Assert URL has ?status=missing (COV-06 round-trip)
    await expect(page).toHaveURL(/status=missing/)
  })

  test('search input — typing "agent" updates URL with q=agent after debounce', async ({ page }) => {
    await page.goto('/coverage')
    const searchInput = page.getByRole('searchbox').or(page.getByLabel(/search repos/i))
    await expect(searchInput).toBeVisible()
    await searchInput.fill('agent')
    // 200ms debounce + 100ms buffer
    await page.waitForTimeout(350)
    await expect(page).toHaveURL(/q=agent/)
  })

  test('override chip — click expands inline list (conditional: skips when no sentinels)', async ({ page }) => {
    // Note: override chip only renders when overrideCount > 0 (Pitfall 5).
    // On machines with no phase-review sentinels, this test self-skips.
    await page.goto('/coverage')
    const chip = page.getByRole('button', { name: /override/i }).first()
    const chipCount = await chip.count()
    if (chipCount > 0) {
      await chip.click()
      await expect(chip).toHaveAttribute('aria-expanded', 'true')
      // Re-click collapses
      await chip.click()
      await expect(chip).toHaveAttribute('aria-expanded', 'false')
    } else {
      test.skip(true, 'No override sentinels on this machine — chip not rendered (Pitfall 5, by design)')
    }
  })

  test('keyboard navigation — Tab through page-header → toolbar → first family section', async ({ page }) => {
    await page.goto('/coverage')
    // Wait for page to stabilise
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Assert focused element is one of the expected interactive targets
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'INPUT', 'A', 'SPAN']).toContain(focused)
  })

  test('desktop layout exposes only the current coverage columns', async ({ page }) => {
    await page.goto('/coverage')
    await expect(page.getByRole('columnheader', { name: 'CLAUDE.md' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Workflow' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Understand' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /GitNexus/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /^Wiki$/i })).toHaveCount(0)
  })

  test('smallest breakpoint omits retired integration labels and actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/coverage')
    await expect(page.getByText('CLAUDE.md').first()).toBeVisible()
    await expect(page.getByText('Workflow').first()).toBeVisible()
    await expect(page.getByText('Understand').first()).toBeVisible()
    await expect(page.getByText(/GitNexus/i)).toHaveCount(0)
    await expect(page.getByText(/^Wiki$/i)).toHaveCount(0)
  })
})
