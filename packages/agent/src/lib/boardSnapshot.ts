import { isAbsolute, relative, resolve, sep } from 'node:path'

import {
  BoardResponseSchema,
  assembleBoardResponse,
  type BoardAssemblyInput,
  type BoardHostEntry,
  type BoardResponse,
  type Host,
  type RegistryEntry,
  type Session,
  type Task,
} from '@agenticapps/dashboard-shared'

export type BoardProjectReference = Pick<RegistryEntry, 'id' | 'root'>

const HOSTS: Host[] = ['claude', 'codex', 'opencode', 'pi']
const SESSION_LIMIT = 200
const TASK_LIMIT = 2_000
const TITLE_CODE_POINT_LIMIT = 256
const NOTE_CODE_POINT_LIMIT = 2_048
const DONE_WINDOW_MS = 24 * 60 * 60 * 1_000
const STATUS_ORDER = new Map<Task['status'], number>([
  ['blocked', 0],
  ['in_progress', 1],
  ['todo', 2],
  ['done', 3],
])

function compareNumberDescending(left: number | undefined, right: number | undefined): number {
  if (left === right) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left > right ? -1 : 1
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)

  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftPoints[index]!.codePointAt(0)!
    const rightPoint = rightPoints[index]!.codePointAt(0)!
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1
  }
  return leftPoints.length - rightPoints.length
}

function compareSessions(left: Session, right: Session): number {
  if (left.active !== right.active) return left.active ? -1 : 1
  return (
    compareNumberDescending(left.updatedAt, right.updatedAt) ||
    compareNumberDescending(left.createdAt, right.createdAt) ||
    compareCodePoints(left.id, right.id)
  )
}

function latestTaskTimestamp(task: Task): number | undefined {
  if (task.startedAt === undefined) return task.completedAt
  if (task.completedAt === undefined) return task.startedAt
  return Math.max(task.startedAt, task.completedAt)
}

function compareTasks(left: Task, right: Task): number {
  return (
    STATUS_ORDER.get(left.status)! - STATUS_ORDER.get(right.status)! ||
    compareNumberDescending(latestTaskTimestamp(left), latestTaskTimestamp(right)) ||
    compareCodePoints(left.id, right.id)
  )
}

function boundCodePoints(value: string, limit: number): { value: string; truncated: boolean } {
  const points = [...value]
  if (points.length <= limit) return { value, truncated: false }
  return { value: points.slice(0, limit).join(''), truncated: true }
}

function symbolicWorkingDirectory(
  cwd: string,
  projects: readonly BoardProjectReference[],
): string {
  if (!isAbsolute(cwd)) return 'external'
  const absoluteCwd = resolve(cwd)

  for (const project of projects) {
    const projectRoot = resolve(project.root)
    const projectRelative = relative(projectRoot, absoluteCwd)
    if (
      projectRelative === '' ||
      (projectRelative !== '..' &&
        !projectRelative.startsWith(`..${sep}`) &&
        !isAbsolute(projectRelative))
    ) {
      const suffix = projectRelative.split(sep).filter(Boolean).join('/')
      return suffix ? `repo:${project.id}/${suffix}` : `repo:${project.id}`
    }
  }
  return 'external'
}

function sessionKey(session: Pick<Session, 'host' | 'id'>): string {
  return `${session.host}\u0000${session.id}`
}

function boundSession(
  session: Session,
  projects: readonly BoardProjectReference[],
): { session: Session; truncated: boolean } {
  const title = boundCodePoints(session.title, TITLE_CODE_POINT_LIMIT)
  return {
    session: {
      ...session,
      title: title.value,
      ...(session.cwd === undefined
        ? {}
        : { cwd: symbolicWorkingDirectory(session.cwd, projects) }),
    },
    truncated: title.truncated,
  }
}

function boundTask(task: Task): { task: Task; truncated: boolean } {
  const title = boundCodePoints(task.title, TITLE_CODE_POINT_LIMIT)
  const note =
    task.note === undefined
      ? undefined
      : boundCodePoints(task.note, NOTE_CODE_POINT_LIMIT)

  return {
    task: {
      ...task,
      title: title.value,
      ...(note === undefined ? {} : { note: note.value }),
    },
    truncated: title.truncated || note?.truncated === true,
  }
}

function completedOutsideWindow(task: Task, generatedAt: number): boolean {
  return (
    task.status === 'done' &&
    task.completedAt !== undefined &&
    task.completedAt < generatedAt - DONE_WINDOW_MS
  )
}

function updatedHostEntry(
  entry: BoardHostEntry,
  values: Pick<
    BoardHostEntry,
    'truncated' | 'omittedSessions' | 'omittedTasks' | 'doneOutsideWindow'
  >,
): BoardHostEntry {
  return { ...entry, ...values }
}

export function buildBoardSnapshot(
  input: BoardAssemblyInput,
  projects: readonly BoardProjectReference[],
): BoardResponse {
  const assembled = assembleBoardResponse(input)
  const sessions: Session[] = []
  const tasks: Task[] = []
  const hosts: BoardHostEntry[] = []

  for (const host of HOSTS) {
    const entry = assembled.hosts.find((candidate) => candidate.host === host)
    if (!entry) throw new Error(`missing assembled host: ${host}`)

    let fieldsTruncated = false
    const orderedSessions = assembled.sessions
      .filter((session) => session.host === host)
      .map((session) => {
        const bounded = boundSession(session, projects)
        fieldsTruncated ||= bounded.truncated
        return bounded.session
      })
      .sort(compareSessions)
    const retainedSessions = orderedSessions.slice(0, SESSION_LIMIT)
    const sessionCapOmissions = orderedSessions.length - retainedSessions.length
    const retainedSessionKeys = new Set(retainedSessions.map(sessionKey))

    const validTasks = assembled.tasks.filter((task) => task.host === host)
    const referentiallyRetainedTasks = validTasks.filter((task) =>
      retainedSessionKeys.has(sessionKey({ host: task.host, id: task.sessionId })),
    )
    const sessionCapTaskOmissions = validTasks.length - referentiallyRetainedTasks.length
    const doneOutsideWindow =
      entry.state === 'absent' ||
      (entry.state === 'unreadable' && entry.reason !== 'invalid-records')
        ? 0
        : referentiallyRetainedTasks.filter((task) =>
            completedOutsideWindow(task, assembled.generatedAt),
          ).length

    const orderedTasks = referentiallyRetainedTasks
      .map((task) => {
        const bounded = boundTask(task)
        fieldsTruncated ||= bounded.truncated
        return bounded.task
      })
      .sort(compareTasks)
    const retainedTasks = orderedTasks.slice(0, TASK_LIMIT)
    const taskCapOmissions = orderedTasks.length - retainedTasks.length

    sessions.push(...retainedSessions)
    tasks.push(...retainedTasks)
    hosts.push(
      updatedHostEntry(entry, {
        truncated:
          entry.truncated ||
          fieldsTruncated ||
          sessionCapOmissions > 0 ||
          sessionCapTaskOmissions > 0 ||
          taskCapOmissions > 0,
        omittedSessions: entry.omittedSessions + sessionCapOmissions,
        omittedTasks:
          entry.omittedTasks + sessionCapTaskOmissions + taskCapOmissions,
        doneOutsideWindow,
      }),
    )
  }

  return BoardResponseSchema.parse({
    generatedAt: assembled.generatedAt,
    synthetic: assembled.synthetic,
    hosts,
    sessions,
    tasks,
  })
}

export function createSyntheticBoardFixture(
  generatedAt: number,
  projects: readonly BoardProjectReference[],
): BoardResponse {
  const statuses: Task['status'][] = ['blocked', 'in_progress', 'todo', 'done']
  const labels = new Map<Host, string>([
    ['claude', 'Claude'],
    ['codex', 'Codex'],
    ['opencode', 'OpenCode'],
    ['pi', 'Pi'],
  ])

  return buildBoardSnapshot(
    {
      generatedAt,
      synthetic: true,
      hosts: HOSTS.map((host, index) => {
        const sessionId = `${host}-session`
        const label = labels.get(host)!
        return {
          host,
          state: 'present',
          sessions: [
            {
              host,
              id: sessionId,
              title: `Synthetic ${label} session`,
              cwd: projects[0]?.root ?? `/synthetic/${host}`,
              createdAt: generatedAt - 60_000,
              updatedAt: generatedAt,
              active: index !== HOSTS.length - 1,
            },
          ],
          tasks: [
            {
              host,
              sessionId,
              id: `${host}-task`,
              title: `Synthetic ${label} task`,
              status: statuses[index]!,
              blockedBy: [],
              blocks: [],
              startedAt: generatedAt - 30_000,
              ...(statuses[index] === 'done' ? { completedAt: generatedAt - 10_000 } : {}),
              note: 'Synthetic fixture data — not a live agent session.',
            },
          ],
        }
      }),
    },
    projects,
  )
}
