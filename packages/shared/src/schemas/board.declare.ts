import type { ZodType } from 'zod'

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

export type BoardHostEntry =
  | BoardPresentHostEntry
  | BoardAbsentHostEntry
  | BoardUnreadableHostEntry

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

export declare const HostSchema: ZodType<Host>
export declare const TaskStatusSchema: ZodType<TaskStatus>
export declare const SessionSchema: ZodType<Session>
export declare const TaskSchema: ZodType<Task>
export declare const BoardHostEntrySchema: ZodType<BoardHostEntry>
export declare const BoardResponseSchema: ZodType<BoardResponse>

/**
 * Builds one strict board envelope from host snapshots.
 *
 * Invalid records, duplicate identities, and tasks without a retained session
 * are excluded and added to the matching host omission count. Any such
 * exclusion makes that host unreadable with `reason: invalid-records`.
 *
 * @throws When the input does not provide exactly one snapshot for every host,
 * or when envelope-level values violate the strict wire contract.
 */
export declare function assembleBoardResponse(
  input: BoardAssemblyInput,
): BoardResponse
