import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { READINESS_FILE_PATH, readReadinessFile } from './readinessFile.js'

let repo: string

function put(relative: string, body: string): void {
  const absolute = join(repo, relative)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, body)
}

const declaredPenTest = {
  id: 'pen-test',
  status: 'ok',
  observedAt: '2026-07-01T09:00:00Z',
  validUntil: '2027-07-01T09:00:00Z',
  evidence: 'docs/security/pen-test.md',
  commit: 'b'.repeat(40),
}

/**
 * A declaration is only usable if the evidence it cites is actually there, so
 * every test that expects a usable file has to put the file on disk.
 */
function putEvidence(): void {
  put(declaredPenTest.evidence, '# pen test\n')
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'readiness-file-'))
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('readReadinessFile', () => {
  it('reports absence as the normal case, with no notice', async () => {
    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('absent')
  })

  // "No file" and "cannot look" are different facts, and conflating them is how
  // a repo could get greener by making its declarations unreachable: `absent`
  // raises no notice, and no notice means the readiness predicate applies the
  // advisory exemption. Every other unreadability mode already produces a
  // notice; this is the one that reached `absent`.
  it('reports an unreadable directory as unusable rather than absent', async () => {
    const dir = join(repo, dirname(READINESS_FILE_PATH))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(repo, READINESS_FILE_PATH), JSON.stringify({ schemaVersion: 1 }))
    chmodSync(dir, 0o000)

    try {
      const outcome = await readReadinessFile(repo)
      expect(outcome.kind).toBe('unusable')
    } finally {
      // Restore before afterEach, or the rm of the sandbox fails too.
      chmodSync(dir, 0o755)
    }
  })

  it('parses a usable file', async () => {
    putEvidence()
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('usable')
    expect(outcome.kind === 'usable' && outcome.file.checks?.[0]?.id).toBe('pen-test')
  })

  // Tier B is trusted author input, and the thing that makes it auditable rather
  // than merely asserted is that the evidence can be opened. A declaration
  // citing a file that is not there is indistinguishable from a claim with
  // nothing behind it, so it invalidates the file the same way any other
  // malformed entry does.
  it('refuses a declaration whose evidence file does not exist', async () => {
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
    expect(outcome.kind === 'unusable' && outcome.notice.code).toBe(
      'readiness-file-invalid',
    )
  })

  // The bound applies to the cited artifact, not only to the readiness file.
  // Without it an author could point the daemon at an arbitrarily large file and
  // have it opened on every scan.
  it('refuses evidence larger than the read bound', async () => {
    put(declaredPenTest.evidence, 'x'.repeat(4 * 1024 * 1024 + 1))
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
  })

  // The blast radius is the file, not the entry: one unopenable citation
  // discards every declaration in it, including declarations that were
  // themselves fine. This is a known weakness rather than a design to preserve —
  // see the change's Open Questions — but it is the shipped contract, and the
  // readiness predicate's unusable-file guard depends on knowing it, so it is
  // pinned rather than left implicit.
  it('discards every declaration when one citation is unopenable', async () => {
    const soundReview = {
      id: 'code-review',
      status: 'ok',
      observedAt: '2026-07-01T09:00:00Z',
      evidence: 'openspec/changes/one/REVIEW.md',
      commit: 'c'.repeat(40),
    }
    put(soundReview.evidence, '# review\n')
    // The pen-test citation is deliberately absent while this one is present.
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [soundReview, declaredPenTest] }),
    )

    // The whole file is refused, so the sound code-review declaration goes with
    // the bad pen-test one. Contrast the unknown-check-id case below, which is
    // the only per-entry discard there is.
    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
  })

  // `stat` succeeds on a directory, so "the path exists" is not the same claim
  // as "the evidence can be opened". A directory named like the report satisfied
  // the first and not the second.
  it('refuses evidence that is a directory rather than a file', async () => {
    mkdirSync(join(repo, declaredPenTest.evidence), { recursive: true })
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
  })

  it('refuses evidence that resolves outside the repository through a symlink', async () => {
    const secret = join(dirname(repo), 'outside-evidence.md')
    writeFileSync(secret, 'secret\n')
    mkdirSync(join(repo, 'docs', 'security'), { recursive: true })
    symlinkSync(secret, join(repo, declaredPenTest.evidence))
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
  })

  it('discards an entry whose check id is unknown without discarding the file', async () => {
    putEvidence()
    put(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          { id: 'accessibility', status: 'ok', observedAt: '2026-07-01T09:00:00Z' },
          declaredPenTest,
        ],
      }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('usable')
    expect(outcome.kind === 'usable' && outcome.file.checks).toHaveLength(1)
  })

  it('reports an unsupported schemaVersion distinctly from having no file', async () => {
    put(READINESS_FILE_PATH, JSON.stringify({ schemaVersion: 2 }))

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
    expect(outcome.kind === 'unusable' && outcome.notice.code).toBe(
      'readiness-file-unsupported-version',
    )
  })

  it('reports unparsable JSON', async () => {
    put(READINESS_FILE_PATH, '{ not json')

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
    expect(outcome.kind === 'unusable' && outcome.notice.code).toBe(
      'readiness-file-unparsable',
    )
  })

  it.each([
    ['a malformed known entry', { schemaVersion: 1, checks: [{ id: 'pen-test', status: 'ok' }] }],
    ['an unknown top-level field', { schemaVersion: 1, tier: 'b' }],
    [
      'an escaping evidence path',
      { schemaVersion: 1, checks: [{ ...declaredPenTest, evidence: '../elsewhere.md' }] },
    ],
    [
      'a coverage path outside the repo',
      { schemaVersion: 1, coverage: { path: '/etc/coverage.json' } },
    ],
  ])('reports %s as an invalid file', async (_label, body) => {
    put(READINESS_FILE_PATH, JSON.stringify(body))

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
    expect(outcome.kind === 'unusable' && outcome.notice.code).toBe('readiness-file-invalid')
  })

  it('refuses a file larger than the read bound', async () => {
    put(READINESS_FILE_PATH, `{"schemaVersion":1,"padding":"${'x'.repeat(200_000)}"}`)

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('unusable')
  })

  it('refuses a readiness file that resolves outside the repository', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'readiness-outside-'))
    try {
      writeFileSync(join(outside, 'readiness.json'), JSON.stringify({ schemaVersion: 1 }))
      mkdirSync(join(repo, '.agenticapps'), { recursive: true })
      symlinkSync(join(outside, 'readiness.json'), join(repo, READINESS_FILE_PATH))

      const outcome = await readReadinessFile(repo)
      expect(outcome.kind).toBe('unusable')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('carries no absolute path in its notice text', async () => {
    put(READINESS_FILE_PATH, '{ not json')

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind === 'unusable' && outcome.notice.message).not.toContain(repo)
  })
})
