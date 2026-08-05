/**
 * Tests for GET /api/projects/:id/openspec — project-dashboard ›
 * Hybrid OpenSpec Read Strategy.
 *
 * The registry list already carries an open-change *summary* per project; this
 * route adds the capability names and their requirement counts. It used to add
 * each change's affected capabilities and the archive too — both withdrawn by
 * the v2 cutover along with the two surfaces that read them, so OS1 now asserts
 * their absence on the wire rather than their contents.
 *
 * OS1: 200 + valid OpenspecProjectStateSchema for a migrated project
 * OS2: a change with no specs/ is still listed, not filtered out
 * OS3: a change with no tasks.md is listed with hasTaskArtifact:false
 * OS4: a project with no openspec/ reads as present:false, not as an error
 * OS5: 404 on unknown projectId
 * OS6: 401 without Authorization header
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OpenspecProjectStateSchema } from '@agenticapps/dashboard-shared'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

const cleanups: Array<() => void> = []

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'openspec-route-'))
  cleanups.push(() => rmSync(d, { recursive: true, force: true }))
  return d
}

/**
 * A conformant capability spec. The `## Requirements` section header is not
 * decoration: the `openspec` CLI only counts requirements nested under it,
 * while the tree reader counts `### Requirement:` headings wherever they sit.
 * Writing the conformant shape is what makes this fixture exercise the parity
 * the spec claims — the assertions below then hold whether or not the binary
 * is installed on the host running the suite, instead of silently testing only
 * whichever path this machine happens to take.
 */
function spec(requirements: string[]): string {
  const body = requirements.map((r) => `### Requirement: ${r}\n\nThe system SHALL ${r}.\n`).join('\n')
  return `# spec\n\n## Purpose\n\nFixture.\n\n## Requirements\n\n${body}`
}

/**
 * A migrated project: one change with a task list and a two-capability spec
 * delta, one change with a task list and no delta, one change with a delta and
 * no task list, plus two declared capabilities and one archived change.
 */
function makeMigratedProject(): string {
  const root = tmp()
  const os = join(root, 'openspec')

  mkdirSync(join(os, 'specs', 'daemon-runtime'), { recursive: true })
  writeFileSync(join(os, 'specs', 'daemon-runtime', 'spec.md'), spec(['A', 'B']))
  mkdirSync(join(os, 'specs', 'help-docs'), { recursive: true })
  writeFileSync(join(os, 'specs', 'help-docs', 'spec.md'), spec(['Only']))

  const withDelta = join(os, 'changes', 'add-thing')
  mkdirSync(join(withDelta, 'specs', 'daemon-runtime'), { recursive: true })
  mkdirSync(join(withDelta, 'specs', 'help-docs'), { recursive: true })
  writeFileSync(join(withDelta, 'specs', 'daemon-runtime', 'spec.md'), '### Requirement: X\n')
  writeFileSync(join(withDelta, 'specs', 'help-docs', 'spec.md'), '### Requirement: Y\n')
  writeFileSync(join(withDelta, 'tasks.md'), '- [x] one\n- [x] two\n- [ ] three\n')

  const noDelta = join(os, 'changes', 'no-delta-yet')
  mkdirSync(noDelta, { recursive: true })
  writeFileSync(join(noDelta, 'tasks.md'), '- [ ] a\n')

  const noTasks = join(os, 'changes', 'no-task-list')
  mkdirSync(join(noTasks, 'specs', 'help-docs'), { recursive: true })
  writeFileSync(join(noTasks, 'specs', 'help-docs', 'spec.md'), '### Requirement: Z\n')

  mkdirSync(join(os, 'changes', 'archive', '2026-07-01-add-old'), { recursive: true })

  // The workflow skill marker, so the project reads as `migrated` rather than
  // `no-workflow`, matching what the registry condition matrix expects.
  mkdirSync(join(root, '.claude', 'skills', 'agentic-apps-workflow'), { recursive: true })
  writeFileSync(join(root, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'), '# skill\n')

  return root
}

/** A project with neither an openspec/ tree nor a workflow skill. */
function makeBareProject(): string {
  const root = tmp()
  writeFileSync(join(root, 'README.md'), '# bare\n')
  return root
}

describe('GET /api/projects/:id/openspec', () => {
  let cleanupHome: () => void
  let token: string
  let registryFile: string

  beforeEach(() => {
    const tmpHome = makeTmpHome()
    cleanupHome = tmpHome.cleanup
    registryFile = join(tmpHome.configDir, 'registry.json')
    const fresh = ensureAuthFile(join(tmpHome.configDir, 'auth.json'))
    setActiveToken(fresh.token)
    token = fresh.token
  })

  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.()
    cleanupHome()
  })

  async function register(root: string): Promise<string> {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: root }),
    })
    const body = (await res.json()) as { id: string }
    return body.id
  }

  async function get(id: string) {
    const app = createApp({ registryFile })
    return app.request(`http://127.0.0.1:5193/api/projects/${id}/openspec`, {
      headers: authHeaders(token),
    })
  }

  it('OS1: 200 + valid state carrying capabilities and no withdrawn field', async () => {
    const id = await register(makeMigratedProject())
    const res = await get(id)
    expect(res.status).toBe(200)

    const parsed = OpenspecProjectStateSchema.parse(await res.json())
    expect(parsed.present).toBe(true)

    expect(parsed.capabilities).toEqual([
      { id: 'daemon-runtime', requirementCount: 2 },
      { id: 'help-docs', requirementCount: 1 },
    ])

    const withDelta = parsed.openChanges.find((c) => c.name === 'add-thing')
    expect(withDelta).toEqual({
      name: 'add-thing',
      completedTasks: 2,
      totalTasks: 3,
      hasTaskArtifact: true,
    })

    // The fixture carries an archive directory and per-change spec deltas on
    // disk; neither may reach the wire. Asserted on the serialised body rather
    // than on a key, because the schema is strict and would have thrown first —
    // this is the assertion that survives a schema regression.
    const raw = JSON.stringify(await (await get(id)).json())
    expect(raw).not.toContain('archived')
    expect(raw).not.toContain('affectedCapabilities')
  })

  it('OS2: a change with no spec delta is still listed', async () => {
    const id = await register(makeMigratedProject())
    const parsed = OpenspecProjectStateSchema.parse(await (await get(id)).json())

    const noDelta = parsed.openChanges.find((c) => c.name === 'no-delta-yet')
    expect(noDelta).toBeDefined()
    // Listed, not filtered out — an incomplete change is the normal case.
    expect(noDelta?.hasTaskArtifact).toBe(true)
  })

  it('OS3: a change with no task artifact is listed, flagged, and not reported as 0 of 0', async () => {
    const id = await register(makeMigratedProject())
    const parsed = OpenspecProjectStateSchema.parse(await (await get(id)).json())

    const noTasks = parsed.openChanges.find((c) => c.name === 'no-task-list')
    expect(noTasks).toBeDefined()
    expect(noTasks?.hasTaskArtifact).toBe(false)
    expect(noTasks?.totalTasks).toBe(0)
  })

  it('OS4: a project with no openspec/ tree reads as present:false, not as an error', async () => {
    const id = await register(makeBareProject())
    const res = await get(id)
    expect(res.status).toBe(200)

    const parsed = OpenspecProjectStateSchema.parse(await res.json())
    expect(parsed).toEqual({
      present: false,
      openChanges: [],
      capabilities: [],
    })
  })

  it('OS5: 404 on an unknown projectId', async () => {
    const res = await get('does-not-exist')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ ok: false, error: 'project_not_found' })
  })

  it('OS6: 401 without an Authorization header', async () => {
    const id = await register(makeMigratedProject())
    const app = createApp({ registryFile })
    const res = await app.request(`http://127.0.0.1:5193/api/projects/${id}/openspec`)
    expect(res.status).toBe(401)
  })
})
