import { ZodError, type ZodSchema } from 'zod'

/**
 * Thrown when an internal state file (auth.json, registry.json) on disk fails
 * Zod validation. Distinct from request-validator ZodError so the error
 * middleware can return 500 schema_drift instead of 422 invalid_request —
 * corrupt server state is not a client error.
 */
export class StateCorruptionError extends Error {
  readonly source: string
  readonly cause: ZodError

  constructor(source: string, cause: ZodError) {
    super(`state file ${source} failed schema validation: ${cause.message}`)
    this.name = 'StateCorruptionError'
    this.source = source
    this.cause = cause
  }
}

/**
 * Parse `data` against `schema`; if it throws ZodError, rethrow as
 * StateCorruptionError tagged with `source` (the logical file name).
 * Use only on internal disk reads — never wrap request-validator parses.
 */
export function parseOrCorrupt<T>(schema: ZodSchema<T>, data: unknown, source: string): T {
  try {
    return schema.parse(data)
  } catch (err) {
    if (err instanceof ZodError) throw new StateCorruptionError(source, err)
    throw err
  }
}
