/**
 * pathDrift.ts — registry path-drift detection and the atomic repair request.
 *
 * Extracted from the withdrawn `schemas/conformance.ts` by `retire-v1-surfaces`.
 * These three shapes were filed under "conformance" because the conformance
 * page was their only reader, but they describe registry state, not a
 * conformance score: §2 of that change retains drift detection, suggested-path
 * discovery and the strict atomic repair endpoint while withdrawing the page.
 * Keeping them in a file named after a deleted capability would misfile them,
 * so they move here and the tier/series/response shapes go with the page.
 *
 * Source of truth for both daemon (packages/agent) and SPA (packages/spa).
 * Schema drift surfaces as a Zod parse error at the route boundary (INV-04).
 * Every nested object is `.strict()` so extra keys are rejected at the wire
 * boundary rather than silently accepted.
 */
import { z } from 'zod'

/**
 * Reason vocabulary for path drift detection (D-12-18).
 * - `missing` — `existsSync` returned false for the stored path
 * - `symlink-target-changed` — `realpath` resolves to a different location
 * - `git-remote-changed` — `.git/config` origin remote drifted vs the
 *   inferred-on-registration value
 */
export const PathDriftReasonSchema = z.enum([
  'missing',
  'symlink-target-changed',
  'git-remote-changed',
])
export type PathDriftReason = z.infer<typeof PathDriftReasonSchema>

/**
 * Drifted registry entry. `suggestedPath` is null when inference failed
 * (D-12-21 — the caller prompts for a corrected path; no auto-fix without
 * confirmation).
 */
export const PathDriftEntrySchema = z
  .object({
    id: z.string(), // registry entry id
    storedPath: z.string(), // value currently in registry.json
    suggestedPath: z.string().nullable(), // null when inference failed
    reason: PathDriftReasonSchema,
  })
  .strict()
export type PathDriftEntry = z.infer<typeof PathDriftEntrySchema>

/**
 * Fix-path request body (D-12-19). The daemon-side handler additionally
 * enforces:
 * - `canonicaliseRoot(newPath)` for realpath-via-realpathSync resolution
 * - `assertRegistrationAllowed(canonical)` blocklist defence
 * - family-root containment check (Pitfall 7 — symlink escape guard)
 * - rate-limiting via `rlConsume(tokHash)` per Phase 1 A-01 pattern
 */
export const RegistryFixPathRequestSchema = z
  .object({
    id: z.string().min(1),
    newPath: z.string().min(1),
  })
  .strict()
export type RegistryFixPathRequest = z.infer<typeof RegistryFixPathRequestSchema>
