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

// ─── Phase 3: prepare/confirm + rename/tags schemas ──────────────────────────

export const RegisterPrepareRequestSchema = z.object({
  path: z.string().min(1),
})
export type RegisterPrepareRequest = z.infer<typeof RegisterPrepareRequestSchema>

/** Inner helpers — not exported individually, used in the union below. */
const DetectedMarkersSchema = z.object({
  gitRepo: z.boolean(),
  planning: z.boolean(),
  claudeSkills: z.boolean(),
})

/** 32-char lowercase hex nonce (D-10: crypto.randomBytes(16).toString('hex')). */
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
 * Discriminated union NOT used here — no single field acts as discriminator
 * across all three shapes (RESEARCH Pattern 20). z.union() matches first.
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

export const RenameRequestSchema = z.object({
  name: z.string().min(1),
})
export type RenameRequest = z.infer<typeof RenameRequestSchema>

export const TagsRequestSchema = z.object({
  tags: z.array(z.string()),
})
export type TagsRequest = z.infer<typeof TagsRequestSchema>
