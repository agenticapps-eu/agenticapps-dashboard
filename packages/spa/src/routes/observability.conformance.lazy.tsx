/**
 * observability.conformance.lazy.tsx — Lazy route wrapper for /observability/conformance.
 *
 * Plan 12-04 (Wave 4): mounts ConformancePage under the _appshell layout.
 * Mirrors observability.skill-drift.lazy.tsx (Phase 11) verbatim — swap the
 * page component, keep the createLazyRoute('/observability/conformance')
 * shape.
 *
 * No validateSearch in v1.2.0 (RESEARCH §REQ-12-PAGE-01 deferral — deep-link
 * to a specific day is deferred).
 */
import { createLazyRoute } from '@tanstack/react-router'

import { ConformancePage } from '../components/panels/conformance/ConformancePage.js'

export const Route = createLazyRoute('/observability/conformance')({
  component: ConformancePage,
})
