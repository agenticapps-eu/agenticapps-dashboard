/**
 * EmDash — the product's single canonical absence marker.
 *
 * `design-system` → A Value Is Shown Where One Exists requires "a single
 * canonical absence marker … an em dash, used consistently across every
 * surface". Before this module there were four markers: a local `EmDash`
 * component private to RepoDetailPage, three separate `return '—'` literals in
 * three formatters, and the words "Unknown" on the workflow surface.
 *
 * Two exports, because there are genuinely two contexts and only one of them
 * can hold an element:
 *
 *   `EmDash`   — for a rendered cell. Carries the tertiary colour, so the
 *                marker reads as deliberate rather than as leftover
 *                punctuation, which is the third scenario's requirement that
 *                absence be tellable from a failed render.
 *   `EM_DASH`  — for string contexts. `ReadinessIndicator.disclose()` builds an
 *                accessible description with a template literal; a component
 *                cannot go inside one. The constant keeps the character itself
 *                single-sourced even where the styling cannot follow.
 *
 * EmDash.test.tsx scans every component for a hard-coded em-dash literal, so a
 * fifth marker cannot quietly appear.
 *
 * Deliberately NOT given an `aria-label`. A bare `<span>` has no role for an
 * accessible name to attach to, so the label would be dropped — the same trap
 * RepoDetailPage's loading region documents. The character is announced as
 * content, which is what a reader needs.
 */
import React from 'react'

/** The character itself. Use where a string is required and an element is not. */
export const EM_DASH = '—'

export function EmDash(): React.JSX.Element {
  return <span className="text-text-tertiary">{EM_DASH}</span>
}
