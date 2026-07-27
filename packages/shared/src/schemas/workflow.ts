import { z } from 'zod'

const SymbolicIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const SemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const CommitSchema = z.string().regex(/^[0-9a-fA-F]{40}$/)

const WorkflowSkillSchema = z
  .object({
    id: SymbolicIdSchema,
    name: SymbolicIdSchema,
    state: z.enum(['known', 'unknown', 'missing']),
    version: SemverSchema.nullable(),
    reason: z
      .enum([
        'expected-skill-missing',
        'frontmatter-missing',
        'implements-spec-missing',
        'implements-spec-duplicate',
        'implements-spec-malformed',
      ])
      .optional(),
  })
  .strict()

const WorkflowArtifactIdSchema = z.enum([
  'change-gate',
  'reviewer-cli',
  'change-gate-harness',
  'reviewer-cli-harness',
])

const WorkflowArtifactSchema = z
  .object({
    artifactId: WorkflowArtifactIdSchema,
    state: z.enum(['identical', 'divergent', 'missing', 'unavailable']),
    sha256: Sha256Schema.nullable(),
    referenceSha256: Sha256Schema.nullable(),
    marker: z
      .object({
        state: z.enum(['valid', 'absent', 'invalid', 'not-applicable']),
        version: SemverSchema.nullable(),
      })
      .strict(),
    provenance: z
      .object({
        state: z.enum(['valid', 'absent', 'invalid']),
        commit: CommitSchema.nullable(),
      })
      .strict(),
  })
  .strict()

function workflowHostSchema(
  hostId:
    | 'claude-workflow'
    | 'codex-workflow'
    | 'opencode-workflow'
    | 'pi-agentic-apps-workflow',
) {
  return z
    .object({
      hostId: z.literal(hostId),
      state: z.enum(['available', 'missing']),
      primary: WorkflowSkillSchema.nullable(),
      skills: z.array(WorkflowSkillSchema),
      minimum: SemverSchema.nullable(),
      maximum: SemverSchema.nullable(),
      laggards: z.array(
        z
          .object({
            id: SymbolicIdSchema,
            name: SymbolicIdSchema,
            version: SemverSchema,
          })
          .strict(),
      ),
      unknowns: z.array(WorkflowSkillSchema),
      internallyConsistent: z.boolean(),
      coreState: z.enum(['current', 'behind', 'ahead', 'unavailable']),
      divergent: z.boolean(),
      artifacts: z.array(WorkflowArtifactSchema),
      migration: z
        .object({
          kind: z.literal('offered'),
          highest: z.string().regex(/^\d{4}$/).nullable(),
        })
        .strict(),
    })
    .strict()
}

function machineRootSchema(
  rootId:
    | 'agenticapps-bin'
    | 'claude-skills'
    | 'codex-skills'
    | 'opencode-skills'
    | 'pi-skills',
) {
  return z
    .object({
      rootId: z.literal(rootId),
      state: z.enum(['present', 'absent']),
      entries: z.array(
        z
          .object({
            id: SymbolicIdSchema,
            state: z.enum(['present', 'missing']),
            artifact: WorkflowArtifactSchema.optional(),
          })
          .strict(),
      ),
    })
    .strict()
}

export const WorkflowResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAtIso: z.string().datetime(),
    core: z
      .object({
        repoId: z.literal('agenticapps-workflow-core'),
        state: z.enum(['available', 'missing']),
        specVersion: SemverSchema.nullable(),
      })
      .strict(),
    hosts: z.tuple([
      workflowHostSchema('claude-workflow'),
      workflowHostSchema('codex-workflow'),
      workflowHostSchema('opencode-workflow'),
      workflowHostSchema('pi-agentic-apps-workflow'),
    ]),
    machineRoots: z.tuple([
      machineRootSchema('agenticapps-bin'),
      machineRootSchema('claude-skills'),
      machineRootSchema('codex-skills'),
      machineRootSchema('opencode-skills'),
      machineRootSchema('pi-skills'),
    ]),
  })
  .strict()

export type WorkflowResponse = z.infer<typeof WorkflowResponseSchema>
