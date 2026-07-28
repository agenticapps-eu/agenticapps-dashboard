import { describe, expect, it } from 'vitest'
import {
  BoardResponseSchema,
  type BoardAssemblyInput,
  type BoardHostSnapshotInput,
  type BoardResponse,
  type Host,
  type Session,
  type Task,
} from '@agenticapps/dashboard-shared'

import {
  buildBoardSnapshot,
  createSyntheticBoardFixture,
  type BoardProjectReference,
} from './boardSnapshot.declare.js'

const HOSTS: Host[] = ['claude', 'codex', 'opencode', 'pi']
const GENERATED_AT = 1_800_000_000_000

function session(host: Host, id: string, overrides: Partial<Session> = {}): Session {
  return {
    host,
    id,
    title: `${host} ${id}`,
    updatedAt: GENERATED_AT,
    active: true,
    ...overrides,
  }
}

function task(
  host: Host,
  sessionId: string,
  id: string,
  overrides: Partial<Task> = {},
): Task {
  return {
    host,
    sessionId,
    id,
    title: `${host} ${id}`,
    status: 'todo',
    blockedBy: [],
    blocks: [],
    ...overrides,
  }
}

function hostSnapshot(
  host: Host,
  overrides: Partial<BoardHostSnapshotInput> = {},
): BoardHostSnapshotInput {
  return {
    host,
    state: 'present',
    sessions: [],
    tasks: [],
    ...overrides,
  }
}

function inputWith(
  host: Host,
  overrides: Partial<BoardHostSnapshotInput>,
): BoardAssemblyInput {
  return {
    generatedAt: GENERATED_AT,
    synthetic: true,
    hosts: HOSTS.map((candidate) =>
      candidate === host ? hostSnapshot(candidate, overrides) : hostSnapshot(candidate),
    ),
  }
}

function hostEntry(response: BoardResponse, host: Host) {
  const entry = response.hosts.find((candidate) => candidate.host === host)
  if (!entry) throw new Error(`missing host entry: ${host}`)
  return entry
}

describe('buildBoardSnapshot', () => {
  it('sorts sessions and tasks by the declared deterministic order', () => {
    const sessions = [
      session('claude', 'inactive', { active: false, updatedAt: GENERATED_AT + 10 }),
      session('claude', 'active-b', { createdAt: 2 }),
      session('claude', 'active-a', { createdAt: 2 }),
      session('claude', 'active-newer', { createdAt: 3 }),
    ]
    const tasks = [
      task('claude', 'active-a', 'done', { status: 'done', completedAt: 10 }),
      task('claude', 'active-a', 'todo', { status: 'todo', startedAt: 20 }),
      task('claude', 'active-a', 'progress', {
        status: 'in_progress',
        startedAt: 30,
      }),
      task('claude', 'active-a', 'blocked-b', {
        status: 'blocked',
        startedAt: 40,
        completedAt: 50,
      }),
      task('claude', 'active-a', 'blocked-a', {
        status: 'blocked',
        startedAt: 50,
      }),
    ]

    const response = buildBoardSnapshot(inputWith('claude', { sessions, tasks }), [])

    expect(response.sessions.filter(({ host }) => host === 'claude').map(({ id }) => id)).toEqual([
      'active-newer',
      'active-a',
      'active-b',
      'inactive',
    ])
    expect(response.tasks.filter(({ host }) => host === 'claude').map(({ id }) => id)).toEqual([
      'blocked-a',
      'blocked-b',
      'progress',
      'todo',
      'done',
    ])
  })

  it('applies per-host caps after referential filtering and reports every omission', () => {
    const sessions = Array.from({ length: 201 }, (_, index) =>
      session('claude', `session-${String(index).padStart(3, '0')}`, {
        updatedAt: GENERATED_AT - index,
      }),
    )
    const tasks = [
      ...Array.from({ length: 2_001 }, (_, index) =>
        task('claude', 'session-000', `task-${String(index).padStart(4, '0')}`, {
          startedAt: GENERATED_AT - index,
        }),
      ),
      task('claude', 'session-200', 'dependent-on-capped-session'),
    ]

    const response = buildBoardSnapshot(inputWith('claude', { sessions, tasks }), [])
    const entry = hostEntry(response, 'claude')

    expect(response.sessions.filter(({ host }) => host === 'claude')).toHaveLength(200)
    expect(response.tasks.filter(({ host }) => host === 'claude')).toHaveLength(2_000)
    expect(entry).toMatchObject({
      state: 'present',
      truncated: true,
      omittedSessions: 1,
      omittedTasks: 2,
    })
    expect(() => BoardResponseSchema.parse(response)).not.toThrow()
  })

  it('bounds free text by Unicode code points without counting field truncation as a record omission', () => {
    const longTitle = '🙂'.repeat(257)
    const longNote = '界'.repeat(2_049)
    const response = buildBoardSnapshot(
      inputWith('opencode', {
        sessions: [session('opencode', 'session', { title: longTitle })],
        tasks: [task('opencode', 'session', 'task', { title: longTitle, note: longNote })],
      }),
      [],
    )
    const entry = hostEntry(response, 'opencode')

    expect([...response.sessions.find(({ host }) => host === 'opencode')!.title]).toHaveLength(256)
    expect([...response.tasks.find(({ host }) => host === 'opencode')!.title]).toHaveLength(256)
    expect([...response.tasks.find(({ host }) => host === 'opencode')!.note!]).toHaveLength(2_048)
    expect(entry).toMatchObject({
      truncated: true,
      omittedSessions: 0,
      omittedTasks: 0,
    })
  })

  it('replaces working directories with existing registry ids or external', () => {
    const projects: BoardProjectReference[] = [
      { id: 'dashboard', root: '/Users/example/Sourcecode/dashboard' },
    ]
    const response = buildBoardSnapshot(
      inputWith('pi', {
        sessions: [
          session('pi', 'inside', { cwd: '/Users/example/Sourcecode/dashboard/packages/spa' }),
          session('pi', 'outside', { cwd: '/Users/example/private' }),
        ],
      }),
      projects,
    )

    expect(response.sessions.map(({ cwd }) => cwd)).toEqual([
      'repo:dashboard/packages/spa',
      'external',
    ])
    expect(JSON.stringify(response)).not.toContain('/Users/example')
  })

  it('excludes an invalid session and its task while degrading only that host', () => {
    const invalidSession = {
      host: 'codex',
      id: 'missing-updated-at',
      title: 'invalid',
      active: true,
    }
    const response = buildBoardSnapshot(
      inputWith('codex', {
        sessions: [invalidSession],
        tasks: [task('codex', 'missing-updated-at', 'dependent')],
      }),
      [],
    )

    expect(response.sessions).toHaveLength(0)
    expect(response.tasks).toHaveLength(0)
    expect(hostEntry(response, 'codex')).toMatchObject({
      state: 'unreadable',
      reason: 'invalid-records',
      omittedSessions: 1,
      omittedTasks: 1,
    })
  })

  it('counts valid completed tasks outside the 24-hour window before the task cap', () => {
    const oldCompletion = GENERATED_AT - 24 * 60 * 60 * 1_000 - 1
    const response = buildBoardSnapshot(
      inputWith('claude', {
        sessions: [session('claude', 'session')],
        tasks: [
          task('claude', 'session', 'old', { status: 'done', completedAt: oldCompletion }),
          task('claude', 'session', 'future', {
            status: 'done',
            completedAt: GENERATED_AT + 1,
          }),
          task('claude', 'session', 'unknown-time', { status: 'done' }),
        ],
      }),
      [],
    )

    expect(hostEntry(response, 'claude').doneOutsideWindow).toBe(1)
    expect(response.tasks.map(({ id }) => id).sort()).toEqual(['future', 'old', 'unknown-time'])
  })
})

describe('createSyntheticBoardFixture', () => {
  it('returns a strict synthetic snapshot with records from all four hosts', () => {
    const response = createSyntheticBoardFixture(GENERATED_AT, [])

    expect(() => BoardResponseSchema.parse(response)).not.toThrow()
    expect(response.synthetic).toBe(true)
    expect(new Set(response.hosts.map(({ host }) => host))).toEqual(new Set(HOSTS))
    expect(new Set(response.sessions.map(({ host }) => host))).toEqual(new Set(HOSTS))
    expect(new Set(response.tasks.map(({ host }) => host))).toEqual(new Set(HOSTS))
  })
})
