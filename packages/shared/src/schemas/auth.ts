import { z } from 'zod'

/**
 * D-13: token is 256 bits (32 random bytes) hex-encoded and chunked into 8
 * groups of 8 hex chars separated by `-`. 71 chars total. Locking the schema
 * to this exact format prevents stale or hand-edited tokens from being
 * accepted into auth.json without going through generateToken().
 */
export const TokenSchema = z.string().regex(/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/, {
  message: 'token must be 8 dash-separated 8-char hex groups (D-13)',
})

export const AuthFileSchema = z.object({
  version: z.literal(1),
  token: TokenSchema,
  rotatedAt: z.string().datetime(),
  agentVersion: z.string().min(1),
})

export type AuthFile = z.infer<typeof AuthFileSchema>
