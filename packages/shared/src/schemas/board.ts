import { z } from 'zod'

export type Host = 'claude' | 'codex' | 'opencode' | 'pi'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

export interface Session {
  host: Host
  id: string
  title: string
  cwd?: string
  createdAt?: number
  updatedAt: number
  active: boolean
}

export interface Task {
  host: Host
  sessionId: string
  id: string
  title: string
  status: TaskStatus
  blockedBy: string[]
  blocks: string[]
  startedAt?: number
  completedAt?: number
  note?: string
}

export type BoardHostState = 'present' | 'absent' | 'unreadable'

export type BoardUnreadableReason =
  | 'invalid-records'
  | 'source-unreadable'
  | 'unsafe-path'
  | 'read-limit'

export interface BoardHostEntryBase {
  host: Host
  truncated: boolean
  omittedSessions: number
  omittedTasks: number
  doneOutsideWindow: number
}

export interface BoardPresentHostEntry extends BoardHostEntryBase {
  state: 'present'
  reason?: never
}

export interface BoardAbsentHostEntry extends BoardHostEntryBase {
  state: 'absent'
  reason?: never
}

export interface BoardUnreadableHostEntry extends BoardHostEntryBase {
  state: 'unreadable'
  reason: BoardUnreadableReason
}

export type BoardHostEntry = BoardPresentHostEntry | BoardAbsentHostEntry | BoardUnreadableHostEntry

export interface BoardResponse {
  generatedAt: number
  synthetic: boolean
  hosts: BoardHostEntry[]
  sessions: Session[]
  tasks: Task[]
}

export interface BoardHostSnapshotInput {
  host: Host
  state: BoardHostState
  reason?: BoardUnreadableReason
  truncated?: boolean
  omittedSessions?: number
  omittedTasks?: number
  doneOutsideWindow?: number
  sessions: readonly unknown[]
  tasks: readonly unknown[]
}

export interface BoardAssemblyInput {
  generatedAt: number
  synthetic: boolean
  hosts: readonly BoardHostSnapshotInput[]
}

const HOSTS = ['claude', 'codex', 'opencode', 'pi'] as const

export const HostSchema = z.enum(HOSTS)
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'blocked'])

const TimestampSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const CountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const BoardUnreadableReasonSchema = z.enum([
  'invalid-records',
  'source-unreadable',
  'unsafe-path',
  'read-limit',
])

export const SessionSchema = z
  .object({
    host: HostSchema,
    id: z.string(),
    title: z.string(),
    cwd: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema,
    active: z.boolean(),
  })
  .strict() as z.ZodType<Session>

export const TaskSchema = z
  .object({
    host: HostSchema,
    sessionId: z.string(),
    id: z.string(),
    title: z.string(),
    status: TaskStatusSchema,
    blockedBy: z.array(z.string()),
    blocks: z.array(z.string()),
    startedAt: TimestampSchema.optional(),
    completedAt: TimestampSchema.optional(),
    note: z.string().optional(),
  })
  .strict() as z.ZodType<Task>

const BoardHostEntryBaseShape = {
  host: HostSchema,
  truncated: z.boolean(),
  omittedSessions: CountSchema,
  omittedTasks: CountSchema,
  doneOutsideWindow: CountSchema,
}

export const BoardHostEntrySchema = z.discriminatedUnion('state', [
  z
    .object({
      ...BoardHostEntryBaseShape,
      state: z.literal('present'),
    })
    .strict(),
  z
    .object({
      ...BoardHostEntryBaseShape,
      state: z.literal('absent'),
    })
    .strict(),
  z
    .object({
      ...BoardHostEntryBaseShape,
      state: z.literal('unreadable'),
      reason: BoardUnreadableReasonSchema,
    })
    .strict(),
]) as z.ZodType<BoardHostEntry>

function sessionKey(value: Pick<Session, 'host' | 'id'>): string {
  return `${value.host}\u0000${value.id}`
}

function taskKey(value: Pick<Task, 'host' | 'sessionId' | 'id'>): string {
  return `${value.host}\u0000${value.sessionId}\u0000${value.id}`
}

export const BoardResponseSchema = z
  .object({
    generatedAt: TimestampSchema,
    synthetic: z.boolean(),
    hosts: z.array(BoardHostEntrySchema),
    sessions: z.array(SessionSchema),
    tasks: z.array(TaskSchema),
  })
  .strict()
  .superRefine((response, context) => {
    const hostCounts = new Map<Host, number>(HOSTS.map((host) => [host, 0]))
    for (const entry of response.hosts) {
      hostCounts.set(entry.host, (hostCounts.get(entry.host) ?? 0) + 1)
    }
    for (const host of HOSTS) {
      if (hostCounts.get(host) !== 1) {
        context.addIssue({
          code: 'custom',
          message: `expected exactly one host entry for ${host}`,
          path: ['hosts'],
        })
      }
    }

    const sessionKeys = new Set<string>()
    for (const value of response.sessions) {
      const key = sessionKey(value)
      if (sessionKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'duplicate session identity',
          path: ['sessions'],
        })
      }
      sessionKeys.add(key)
    }

    const taskKeys = new Set<string>()
    for (const value of response.tasks) {
      const key = taskKey(value)
      if (taskKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'duplicate task identity',
          path: ['tasks'],
        })
      }
      taskKeys.add(key)
      if (!sessionKeys.has(sessionKey({ host: value.host, id: value.sessionId }))) {
        context.addIssue({
          code: 'custom',
          message: 'task does not reference a retained session',
          path: ['tasks'],
        })
      }
    }

    for (const entry of response.hosts) {
      if (
        entry.state === 'absent' &&
        (response.sessions.some(({ host }) => host === entry.host) ||
          response.tasks.some(({ host }) => host === entry.host))
      ) {
        context.addIssue({
          code: 'custom',
          message: 'absent host cannot contribute records',
          path: ['hosts'],
        })
      }
    }
  }) as z.ZodType<BoardResponse>

const BoardHostSnapshotInputSchema = z
  .object({
    host: HostSchema,
    state: z.enum(['present', 'absent', 'unreadable']),
    reason: BoardUnreadableReasonSchema.optional(),
    truncated: z.boolean().optional(),
    omittedSessions: CountSchema.optional(),
    omittedTasks: CountSchema.optional(),
    doneOutsideWindow: CountSchema.optional(),
    sessions: z.array(z.unknown()),
    tasks: z.array(z.unknown()),
  })
  .strict()

const BoardAssemblyInputSchema = z
  .object({
    generatedAt: TimestampSchema,
    synthetic: z.boolean(),
    hosts: z.array(BoardHostSnapshotInputSchema),
  })
  .strict()

function duplicateKeys<T>(values: readonly T[], keyOf: (value: T) => string): Set<string> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = keyOf(value)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}

export function assembleBoardResponse(input: BoardAssemblyInput): BoardResponse {
  const parsedInput = BoardAssemblyInputSchema.parse(input)
  const snapshots = new Map<Host, z.infer<typeof BoardHostSnapshotInputSchema>>()

  for (const snapshot of parsedInput.hosts) {
    if (snapshots.has(snapshot.host)) {
      throw new Error(`duplicate host snapshot: ${snapshot.host}`)
    }
    snapshots.set(snapshot.host, snapshot)
  }
  if (snapshots.size !== HOSTS.length) {
    throw new Error('expected exactly one snapshot for every host')
  }

  const hosts: BoardHostEntry[] = []
  const sessions: Session[] = []
  const tasks: Task[] = []

  for (const host of HOSTS) {
    const snapshot = snapshots.get(host)
    if (!snapshot) throw new Error(`missing host snapshot: ${host}`)
    if (
      snapshot.state === 'absent' &&
      (snapshot.sessions.length > 0 || snapshot.tasks.length > 0)
    ) {
      throw new Error(`absent host contributed records: ${host}`)
    }
    if (snapshot.state === 'unreadable' && !snapshot.reason) {
      throw new Error(`unreadable host is missing a reason: ${host}`)
    }
    if (snapshot.state !== 'unreadable' && snapshot.reason) {
      throw new Error(`${snapshot.state} host cannot carry a reason: ${host}`)
    }

    let omittedSessions = snapshot.omittedSessions ?? 0
    let omittedTasks = snapshot.omittedTasks ?? 0

    const parsedSessions: Session[] = []
    for (const candidate of snapshot.sessions) {
      const result = SessionSchema.safeParse(candidate)
      if (!result.success || result.data.host !== host) {
        omittedSessions += 1
        continue
      }
      parsedSessions.push(result.data)
    }

    const duplicateSessionKeys = duplicateKeys(parsedSessions, sessionKey)
    omittedSessions += parsedSessions.filter((value) =>
      duplicateSessionKeys.has(sessionKey(value)),
    ).length
    const retainedSessions = parsedSessions.filter(
      (value) => !duplicateSessionKeys.has(sessionKey(value)),
    )
    const retainedSessionKeys = new Set(retainedSessions.map(sessionKey))

    const parsedTasks: Task[] = []
    for (const candidate of snapshot.tasks) {
      const result = TaskSchema.safeParse(candidate)
      if (!result.success || result.data.host !== host) {
        omittedTasks += 1
        continue
      }
      parsedTasks.push(result.data)
    }

    const duplicateTaskKeys = duplicateKeys(parsedTasks, taskKey)
    omittedTasks += parsedTasks.filter((value) => duplicateTaskKeys.has(taskKey(value))).length
    const uniqueTasks = parsedTasks.filter((value) => !duplicateTaskKeys.has(taskKey(value)))
    const retainedTasks = uniqueTasks.filter((value) => {
      const retained = retainedSessionKeys.has(
        sessionKey({ host: value.host, id: value.sessionId }),
      )
      if (!retained) omittedTasks += 1
      return retained
    })

    sessions.push(...retainedSessions)
    tasks.push(...retainedTasks)

    const invalidRecords =
      omittedSessions > (snapshot.omittedSessions ?? 0) ||
      omittedTasks > (snapshot.omittedTasks ?? 0)
    const base = {
      host,
      truncated: snapshot.truncated ?? false,
      omittedSessions,
      omittedTasks,
      doneOutsideWindow: snapshot.doneOutsideWindow ?? 0,
    }

    if (snapshot.state === 'unreadable') {
      hosts.push({
        ...base,
        state: 'unreadable',
        reason: snapshot.reason!,
      })
    } else if (invalidRecords) {
      hosts.push({
        ...base,
        state: 'unreadable',
        reason: 'invalid-records',
      })
    } else {
      hosts.push({
        ...base,
        state: snapshot.state,
      })
    }
  }

  return BoardResponseSchema.parse({
    generatedAt: parsedInput.generatedAt,
    synthetic: parsedInput.synthetic,
    hosts,
    sessions,
    tasks,
  })
}
