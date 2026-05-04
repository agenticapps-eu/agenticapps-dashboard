import { z } from 'zod'

import { TokenSchema } from './auth.js'

/**
 * Pair-URL agent host validator.
 * Phase 2 single source of truth (per RESEARCH.md Pitfall 6).
 *
 * Matches:
 *   http://localhost(:1-5digit-port)?
 *   http://127.0.0.1(:1-5digit-port)?
 *   http(s)?://<label>.<...>.ts.net(:1-5digit-port)?  (Phase 1 D-19 hostname pattern; ≥1 dot before .ts.net)
 *
 * Rejects: bare IPs other than 127.0.0.1, lookalike domains
 *          (e.g. ts.net.attacker.com), schemes other than http/https,
 *          ports outside 1-5 digits.
 */
export const AGENT_URL_REGEX =
  /^(?:http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?|https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net(?::\d{1,5})?)$/i

export const AgentUrlSchema = z.string().regex(AGENT_URL_REGEX, {
  message: 'agent URL must be loopback or *.ts.net',
})

export const PairingSchema = z.object({
  agentUrl: AgentUrlSchema,
  token: TokenSchema,
  pairedAt: z.string().datetime(),
})
export type Pairing = z.infer<typeof PairingSchema>
