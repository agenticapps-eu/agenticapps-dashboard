import { z } from 'zod'

export const RegistryEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
  client: z.string().nullable(),
  addedAt: z.string().datetime(),
  tags: z.array(z.string()),
})
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>

export const RegistryFileSchema = z.object({
  version: z.literal(1),
  projects: z.array(RegistryEntrySchema),
})
export type RegistryFile = z.infer<typeof RegistryFileSchema>

export const RegistryListItemSchema = RegistryEntrySchema.extend({
  status: z.object({
    reachable: z.boolean(),
    currentPhase: z.string().nullable(),
    lastCommitAt: z.string().datetime().nullable(),
  }),
})
export type RegistryListItem = z.infer<typeof RegistryListItemSchema>

export const RegistryListResponseSchema = z.array(RegistryListItemSchema)
export type RegistryListResponse = z.infer<typeof RegistryListResponseSchema>

export const RegisterResponseSchema = RegistryEntrySchema.extend({
  alreadyRegistered: z.boolean(),
})
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>

export const StatusResponseSchema = z.object({
  reachable: z.boolean(),
  uptime: z.number().int().nonnegative(),
  bindUrl: z.string().url(),
  registryCount: z.number().int().nonnegative(),
  pairedSince: z.string().datetime().nullable(),
  tokenAge: z.number().int().nonnegative(),
})
export type StatusResponse = z.infer<typeof StatusResponseSchema>

// ── Phase 3: prepare/confirm two-step registration (D-09..D-11) ──────────────

export const RegisterPrepareRequestSchema = z.object({
  path: z.string().min(1),
})
export type RegisterPrepareRequest = z.infer<typeof RegisterPrepareRequestSchema>

const DetectedMarkersSchema = z.object({
  gitRepo: z.boolean(),
  planning: z.boolean(),
  claudeSkills: z.boolean(),
})

/**
 * 32-char lowercase hex nonce (crypto.randomBytes(16).toString('hex')) per D-10.
 */
const NonceHexSchema = z.string().regex(/^[0-9a-f]{32}$/)

const RegisterPrepareAllowedSchema = z.object({
  canonicalRoot: z.string(),
  suggestedName: z.string(),
  suggestedSlug: z.string(),
  alreadyRegistered: z.literal(false),
  blocked: z.literal(false),
  detectedMarkers: DetectedMarkersSchema,
  nonce: NonceHexSchema,
  expiresAt: z.number().int(),
})

const RegisterPrepareBlockedSchema = z.object({
  canonicalRoot: z.string(),
  blocked: z.literal(true),
  blockedReason: z.string(),
})

const RegisterPrepareAlreadyRegisteredSchema = z.object({
  canonicalRoot: z.string(),
  alreadyRegistered: z.literal(true),
  existingEntry: RegistryEntrySchema,
})

/**
 * Three-way union per RESEARCH Pattern 20.
 * NOT discriminatedUnion — no single discriminator field covers all three shapes.
 */
export const RegisterPrepareResponseSchema = z.union([
  RegisterPrepareAllowedSchema,
  RegisterPrepareBlockedSchema,
  RegisterPrepareAlreadyRegisteredSchema,
])
export type RegisterPrepareResponse = z.infer<typeof RegisterPrepareResponseSchema>

export const RegisterConfirmRequestSchema = z.object({
  nonce: NonceHexSchema,
  name: z.string().min(1).optional(),
  client: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})
export type RegisterConfirmRequest = z.infer<typeof RegisterConfirmRequestSchema>

/** Confirm returns the same shape as the legacy /register endpoint. */
export const RegisterConfirmResponseSchema = RegisterResponseSchema
export type RegisterConfirmResponse = z.infer<typeof RegisterConfirmResponseSchema>

// ── Phase 3: rename + tags mutation schemas (D-24) ───────────────────────────

export const RenameRequestSchema = z.object({
  name: z.string().min(1),
})
export type RenameRequest = z.infer<typeof RenameRequestSchema>

export const TagsRequestSchema = z.object({
  tags: z.array(z.string()),
})
export type TagsRequest = z.infer<typeof TagsRequestSchema>
