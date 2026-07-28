import { describe, expect, it } from 'vitest'

import {
  BoardHostEntrySchema,
  BoardResponseSchema,
  HostSchema,
  SessionSchema,
  TaskSchema,
  TaskStatusSchema,
  assembleBoardResponse,
  type BoardAssemblyInput,
  type BoardHostEntry,
  type BoardHostSnapshotInput,
  type BoardResponse,
  type Host,
  type Session,
  type Task,
} from './board.js'

const HOSTS: Host[] = ['claude', 'codex', 'opencode', 'pi']

function session(host: Host, id = 'session-1'): Session {
  return {
    host,
    id,
    title: `${host} session`,
    updatedAt: 1_800_000_000_000,
    active: true,
  }
}

function task(host: Host, sessionId = 'session-1', id = 'task-1'): Task {
  return {
    host,
    sessionId,
    id,
    title: `${host} task`,
    status: 'in_progress',
    blockedBy: [],
    blocks: [],
  }
}

function hostSnapshot(
  host: Host,
  overrides: Partial<BoardHostSnapshotInput> = {},
): BoardHostSnapshotInput {
  return {
    host,
    state: 'present',
    sessions: [session(host)],
    tasks: [task(host)],
    ...overrides,
  }
}

function assemblyInput(
  overrides: Partial<Record<Host, BoardHostSnapshotInput>> = {},
): BoardAssemblyInput {
  return {
    generatedAt: 1_800_000_000_000,
    synthetic: true,
    hosts: HOSTS.map((host) => overrides[host] ?? hostSnapshot(host)),
  }
}

function hostEntry(response: BoardResponse, host: Host): BoardHostEntry {
  const entry = response.hosts.find((candidate) => candidate.host === host)
  if (!entry) throw new Error(`missing host entry: ${host}`)
  return entry
}

describe('frozen upstream board record schemas', () => {
  it('accepts exactly the four upstream hosts and four task statuses', () => {
    expect(HOSTS.map((host) => HostSchema.parse(host))).toEqual(HOSTS)
    expect(
      ['todo', 'in_progress', 'done', 'blocked'].map((status) =>
        TaskStatusSchema.parse(status),
      ),
    ).toEqual(['todo', 'in_progress', 'done', 'blocked'])

    expect(() => HostSchema.parse('cursor')).toThrow()
    expect(() => TaskStatusSchema.parse('cancelled')).toThrow()
  })

  it('requires Session.updatedAt while preserving only upstream fields', () => {
    expect(SessionSchema.parse(session('claude'))).toEqual(session('claude'))

    const { updatedAt: _, ...missingUpdatedAt } = session('claude')
    expect(() => SessionSchema.parse(missingUpdatedAt)).toThrow()
    expect(() =>
      SessionSchema.parse({ ...session('claude'), renamedAt: 123 }),
    ).toThrow()
  })

  it('keeps Task strict and all timestamp fields in epoch milliseconds', () => {
    const value: Task = {
      ...task('pi'),
      startedAt: 1_799_999_000_000,
      completedAt: 1_800_000_000_000,
      note: 'finished',
    }

    expect(TaskSchema.parse(value)).toEqual(value)
    expect(() => TaskSchema.parse({ ...value, status: 'queued' })).toThrow()
    expect(() => TaskSchema.parse({ ...value, extra: true })).toThrow()
  })
})

describe('BoardHostEntrySchema', () => {
  const counts = {
    truncated: false,
    omittedSessions: 0,
    omittedTasks: 0,
    doneOutsideWindow: 0,
  }

  it('requires an allowed reason exactly when state is unreadable', () => {
    expect(
      BoardHostEntrySchema.parse({
        host: 'claude',
        state: 'unreadable',
        reason: 'invalid-records',
        ...counts,
      }),
    ).toMatchObject({ state: 'unreadable', reason: 'invalid-records' })

    expect(() =>
      BoardHostEntrySchema.parse({
        host: 'claude',
        state: 'unreadable',
        ...counts,
      }),
    ).toThrow()
    expect(() =>
      BoardHostEntrySchema.parse({
        host: 'claude',
        state: 'unreadable',
        reason: 'raw EACCES /Users/example',
        ...counts,
      }),
    ).toThrow()
  })

  it.each(['present', 'absent'] as const)(
    'rejects reason when state is %s',
    (state) => {
      expect(() =>
        BoardHostEntrySchema.parse({
          host: 'codex',
          state,
          reason: 'source-unreadable',
          ...counts,
        }),
      ).toThrow()
    },
  )

  it('accepts only non-negative safe-integer counts', () => {
    const base = {
      host: 'opencode',
      state: 'present',
      ...counts,
    }
    expect(() =>
      BoardHostEntrySchema.parse({ ...base, omittedTasks: -1 }),
    ).toThrow()
    expect(() =>
      BoardHostEntrySchema.parse({ ...base, omittedTasks: 0.5 }),
    ).toThrow()
    expect(() =>
      BoardHostEntrySchema.parse({
        ...base,
        omittedTasks: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow()
  })
})

describe('assembleBoardResponse', () => {
  it('builds a strict response with exactly one entry for every host', () => {
    const response = assembleBoardResponse(assemblyInput())

    expect(response.hosts.map(({ host }) => host)).toEqual(HOSTS)
    expect(response.sessions).toHaveLength(4)
    expect(response.tasks).toHaveLength(4)
    expect(BoardResponseSchema.parse(response)).toEqual(response)
  })

  it('keeps equal native identifiers distinct across hosts', () => {
    const response = assembleBoardResponse(assemblyInput())

    expect(
      response.sessions.map(({ host, id }) => `${host}:${id}`),
    ).toHaveLength(4)
    expect(
      response.tasks.map(
        ({ host, sessionId, id }) => `${host}:${sessionId}:${id}`,
      ),
    ).toHaveLength(4)
  })

  it('excludes every participant in a duplicate session identity', () => {
    const duplicate = session('claude')
    const response = assembleBoardResponse(
      assemblyInput({
        claude: hostSnapshot('claude', {
          sessions: [duplicate, { ...duplicate }],
          tasks: [task('claude')],
        }),
      }),
    )

    expect(response.sessions.filter(({ host }) => host === 'claude')).toEqual(
      [],
    )
    expect(response.tasks.filter(({ host }) => host === 'claude')).toEqual([])
    expect(hostEntry(response, 'claude')).toMatchObject({
      state: 'unreadable',
      reason: 'invalid-records',
      omittedSessions: 2,
      omittedTasks: 1,
    })
  })

  it('excludes every participant in a duplicate task identity', () => {
    const duplicate = task('codex')
    const response = assembleBoardResponse(
      assemblyInput({
        codex: hostSnapshot('codex', {
          tasks: [duplicate, { ...duplicate }],
        }),
      }),
    )

    expect(response.tasks.filter(({ host }) => host === 'codex')).toEqual([])
    expect(hostEntry(response, 'codex')).toMatchObject({
      state: 'unreadable',
      reason: 'invalid-records',
      omittedTasks: 2,
    })
  })

  it('excludes invalid sessions and every task that depends on them', () => {
    const invalidSession = {
      host: 'opencode',
      id: 'session-1',
      title: 'missing freshness',
      active: true,
    }
    const response = assembleBoardResponse(
      assemblyInput({
        opencode: hostSnapshot('opencode', {
          sessions: [invalidSession],
          tasks: [task('opencode')],
        }),
      }),
    )

    expect(
      response.sessions.filter(({ host }) => host === 'opencode'),
    ).toEqual([])
    expect(response.tasks.filter(({ host }) => host === 'opencode')).toEqual([])
    expect(hostEntry(response, 'opencode')).toMatchObject({
      state: 'unreadable',
      reason: 'invalid-records',
      omittedSessions: 1,
      omittedTasks: 1,
    })
  })

  it('excludes a task that does not resolve within the same host and session', () => {
    const response = assembleBoardResponse(
      assemblyInput({
        pi: hostSnapshot('pi', {
          tasks: [task('pi', 'missing-session')],
        }),
      }),
    )

    expect(response.tasks.filter(({ host }) => host === 'pi')).toEqual([])
    expect(hostEntry(response, 'pi')).toMatchObject({
      state: 'unreadable',
      reason: 'invalid-records',
      omittedTasks: 1,
    })
  })

  it('rejects a host set that is missing or duplicates a known host', () => {
    const missing = assemblyInput()
    missing.hosts = missing.hosts.slice(0, 3)
    expect(() => assembleBoardResponse(missing)).toThrow()

    const duplicate = assemblyInput()
    duplicate.hosts = [
      ...duplicate.hosts.slice(0, 3),
      hostSnapshot('claude'),
    ]
    expect(() => assembleBoardResponse(duplicate)).toThrow()
  })
})
