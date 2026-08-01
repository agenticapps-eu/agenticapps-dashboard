## Reviewer: gemini
_generated 2026-08-01T10:18:31Z · timeout 540s_

VERDICT: REQUEST-CHANGES

*   **Feasibility of enforcing token roles:** The new requirement "Fill Colours And Foreground Colours Are Separate Tokens" includes a scenario where an automated test fails if a component pairs fixed-luminance text with a foreground-role token. This is a strong goal, but the spec lacks detail on the implementation strategy. Please clarify if this test is feasible with our current tooling or if it's an aspirational check that might be difficult to automate.
*   **Design review for light-theme corrections:** The change alters `status-warning` and `status-success` in the *light* theme to meet WCAG floors. While technically correct, this is a visible change to a shipping appearance. Please confirm this specific color shift has been reviewed and approved from a design perspective, not just based on the numerical contrast values.
*   **Tracking deferred structural issues:** The risk mitigation for the dark-mode review states structural issues are out of scope and will be filed. Please link the ticket(s) for these deferred issues directly in the spec for tracking purposes, ensuring they are not lost.

## Reviewer: codex
_generated 2026-08-01T10:20:15Z · timeout 540s_

VERDICT: REQUEST-CHANGES

- The change violates the existing “all colour from named design tokens” requirement by retaining `text-white` and adding plugin-owned `dark:prose-invert`. Add an on-fill text token and tokenize prose colours, or explicitly amend the requirement with justified exceptions.
- The artifacts disagree on `CoverageCell`: proposal/design specify `bg-card-bg-hover` with tertiary text, while `tasks.md` uses `bg-text-tertiary/10` with secondary text and explicitly rejects the neutral surface. Reconcile the proposal, design, tasks, and pairing matrix.
- “Every pairing that occurs” is not enforced. The matrix is manually maintained, and fill-edge assertions cover only `app-bg` and `card-bg`, despite filled navigation controls rendering on `sidebar-bg`. New pairings can therefore ship without contrast coverage.
- The completeness test appears to prove declaration-set parity, not that every required appearance-scoped property exists. A property omitted from all appearances would pass unless a canonical required set is defined.
- Accepting baked light-colour fallbacks can produce incorrect dark rendering in unsupported/older browsers. “Every current browser” needs a normative supported-browser baseline, or the fallback must be fixed and tested.
- The proposal says four light values change but lists only two; the Impact section also says two. Correct the scope count.

## Reviewer: opencode
_generated 2026-08-01T10:22:03Z · timeout 540s_

The change appears already implemented locally — let me verify a few claims against the actual code before delivering the verdict.
VERDICT: REQUEST-CHANGES

- **First-paint flash of light is unaddressed and contradicts the headline claim.** `index.html` has no inline theme script; the light `@theme` values are the `:root` defaults, `:root` declares `color-scheme: light`, and `initTheme()` runs inside an async-loaded module (`main.tsx`). A default-dark user paints light tokens and light UA chrome until JS evaluates. "initTheme() runs before createRoot()" only orders JS, not paint. The change's stated purpose is killing "says dark, renders light" — it reintroduces it transiently on every load, and neither Risks nor Open Questions mentions it. Fix is small (blocking inline script or explicit accepted-risk entry), but it must be one or the other.

- **Fill-vs-surface matrix omits `sidebar-bg`, contradicting D-5's own principle.** The non-text floor for fills is asserted only against `app-bg` and `card-bg`, yet the design's canonical fill example (D-3, `SidebarItem.tsx:5` "active state = bg-accent-bg-strong + text-white") renders on `sidebar-bg`. I computed the values pass (dark ≈ 3.6:1, light ≈ 6.0:1), so nothing is shipping broken — but "pairings that actually occur, verified by grep" is the design's core discipline, and the most-cited fill pairing is not in the matrix. Add it or explain the exclusion.

- **Spec overpromises enforcement strength.** "A component pairs fixed-luminance text with a foreground-role token → the pairing cannot reach the default branch" is backed by `fillRole.test.ts`, which is a lexical scan of `.ts/.tsx` source. Class composition via props, `clsx` indirection, or string concatenation evades it. Worth keeping the test; the scenario's absolutism is wrong as written ("an automated test fails for class names statically present in source" is the true guarantee).

- **Tint↔surface coupling is a snapshot, not an invariant.** The "A tinted surface is a background" scenario reads as a general guarantee, but the matrix enumerates today's grep-verified tint-over-surface pairs. Nothing ties `bg-status-success/10` to its asserted ground — a future component rendering the same tint on a different surface passes CI unasserted. Unlike the fill role, there is no source-level enforcement here. Either scope the scenario language down or add the scan.

- **"148 assertions / 74 per appearance" is a generated count stated as prose fact** in proposal.md and the `tokens.css` header comment. Nothing ties the number to the matrix; it will drift silently on the next pairing change. Drop the count from the docs or assert it.

- **Dormant runtime path becomes load-bearing with no cited activation test.** `applyTheme()`, the `system` branch, and the `matchMedia` listener were written against a no-op `.dark`; this change makes them user-visible for the first time. No test evidence for the switching path is referenced. At minimum a Risks entry; ideally a smoke test that toggling the class repaints.

Minor nits (not blocking): `color-scheme` is a plain property, not a "custom property the appearance defines" (D-9 wording; the test handles it separately, so make the decision text match). No security/PII concerns — CSS-only, no data handling. The grep for stray Tailwind built-in palette classes came back clean, so the "three classes don't follow tokens" remediation is complete as claimed.

