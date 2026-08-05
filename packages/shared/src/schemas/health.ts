import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  message: z.string().optional(),
  // New in Phase 1 (optional for backward-compat with Phase 0 --version --json):
  daemonVersion: z.string().optional(),
  registryCount: z.number().int().nonnegative().optional(),
  paired: z.boolean().optional(),
  // The `understand` block reported the knowledge-graph viewer's install state.
  // It went with the viewer itself in `retire-v1-surfaces`: the code-intelligence
  // delta withdraws `Viewer Asset Installation` and says the analysis status is
  // no longer reported anywhere in the dashboard.
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
