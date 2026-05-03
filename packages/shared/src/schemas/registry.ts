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

export const StatusResponseSchema = z.object({
  reachable: z.boolean(),
  uptime: z.number().int().nonnegative(),
  bindUrl: z.string().url(),
  registryCount: z.number().int().nonnegative(),
  pairedSince: z.string().datetime().nullable(),
  tokenAge: z.number().int().nonnegative(),
})
export type StatusResponse = z.infer<typeof StatusResponseSchema>
