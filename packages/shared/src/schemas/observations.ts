import { z } from 'zod'

/**
 * Single hook firing event from .planning/skill-observations/*.jsonl.
 * D-4-06: passthrough preserves unknown future meta-observer fields without
 * triggering schema drift. Required minimum: ts (ISO8601), skill, hook.
 */
export const HookFiringSchema = z
  .object({
    ts: z.string(),
    skill: z.string(),
    hook: z.string(),
  })
  .passthrough()
export type HookFiring = z.infer<typeof HookFiringSchema>

/**
 * GET /api/projects/:id/observations/recent response.
 * D-4-15: skillInstalled distinguishes "skill absent (show install hint)"
 * from "skill present, no events yet".
 */
export const ObservationsRecentResponseSchema = z.object({
  entries: z.array(HookFiringSchema),
  skillInstalled: z.boolean(),
})
export type ObservationsRecentResponse = z.infer<typeof ObservationsRecentResponseSchema>
