import { z } from 'zod'

export const ReadResponseSchema = z.object({
  content: z.string(),
  mtime: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
export type ReadResponse = z.infer<typeof ReadResponseSchema>

/**
 * Top-level project directories readable through `/api/projects/:id/read`.
 *
 * The daemon's `resolveAllowed` is the enforcement point and imports this
 * constant; nothing here grants access. It lives in shared because a client
 * needs to know what the route will accept *before* offering to open a file —
 * the readiness detail names evidence paths it cannot serve rather than
 * offering a control that 422s.
 *
 * Changing this list changes what the daemon will read. It is not presentation.
 */
export const ALLOWED_SUBDIRS = ['.planning', '.claude', 'openspec'] as const

/**
 * Whether the read route would accept this repo-relative path on its shape
 * alone. A conservative mirror of the daemon's pre-checks: absolute paths,
 * traversal and anything outside the allow-listed subdirectories are out.
 *
 * It cannot mirror the rest, and does not try. Existence, file mode, size and
 * symlink containment are filesystem properties the daemon resolves at read
 * time, so a `true` here means "worth offering", never "will succeed".
 */
export function isReadableProjectPath(path: string): boolean {
  if (path === '') return false
  if (path.startsWith('/') || path.startsWith('~')) return false
  if (/^[A-Za-z]:/.test(path)) return false

  const segments = path.split(/[/\\]/)
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false
  }
  // A file inside one of the three, never one of the three themselves — the
  // route serves regular files, and a bare directory name is not one.
  return segments.length > 1 && ALLOWED_SUBDIRS.some((dir) => segments[0] === dir)
}
