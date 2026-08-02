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

import {
  READINESS_FILE_PATH,
  readReadinessFile,
  type ReadinessFileOutcome,
} from './readinessFile.js'

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

/** The check ids whose citation was refused, or [] for any other outcome. */
const rejectedIds = (outcome: ReadinessFileOutcome): string[] =>
  outcome.kind === 'usable' ? [...outcome.rejected.keys()] : []

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
  // citing a file that is not there is a claim with nothing behind it, so the
  // entry is refused — but the entry only, and the file stays usable.
  it('rejects a declaration whose evidence file does not exist', async () => {
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('usable')
    expect(rejectedIds(outcome)).toEqual(['pen-test'])
    expect(outcome.kind === 'usable' && outcome.notice?.code).toBe(
      'readiness-file-invalid',
    )
  })

  // The bound applies to the cited artifact, not only to the readiness file.
  // Without it an author could point the daemon at an arbitrarily large file and
  // have it opened on every scan.
  it('rejects evidence larger than the read bound', async () => {
    put(declaredPenTest.evidence, 'x'.repeat(4 * 1024 * 1024 + 1))
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(rejectedIds(outcome)).toEqual(['pen-test'])
  })

  // The blast radius is the entry, not the file. One moved artifact used to
  // discard every unrelated declaration in the repo — including declarations
  // that were themselves fine — and because discarded declarations fell back to
  // derived values it could move a repo's results in either direction.
  it('keeps a sound declaration when a sibling citation is unopenable', async () => {
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

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind).toBe('usable')
    expect(rejectedIds(outcome)).toEqual(['pen-test'])
    // The sound declaration survives its neighbour's failure.
    expect(outcome.kind === 'usable' && outcome.file.checks).toHaveLength(2)
  })

  // Returning on the first failure would make an author fix three broken
  // citations one scan at a time.
  it('collects every rejected citation rather than stopping at the first', async () => {
    const cite = (id: string, evidence: string) => ({
      id,
      status: 'ok',
      observedAt: '2026-07-01T09:00:00Z',
      evidence,
      commit: 'c'.repeat(40),
    })
    put(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [
          cite('code-review', 'docs/review.md'),
          cite('security-review', 'docs/security.md'),
          declaredPenTest,
        ],
      }),
    )

    const outcome = await readReadinessFile(repo)
    expect(rejectedIds(outcome).sort()).toEqual([
      'code-review',
      'pen-test',
      'security-review',
    ])
  })

  // Six citations at the schema's 512-character path limit would blow the
  // notice's 600-character bound, and a notice the outbound validator truncates
  // or rejects is worse than one that names a count.
  it('names one rejected citation and counts the rest in the notice', async () => {
    const cite = (id: string, evidence: string) => ({
      id,
      status: 'ok',
      observedAt: '2026-07-01T09:00:00Z',
      evidence,
      commit: 'c'.repeat(40),
    })
    put(
      READINESS_FILE_PATH,
      JSON.stringify({
        schemaVersion: 1,
        checks: [cite('code-review', 'a'.repeat(400) + '.md'), declaredPenTest],
      }),
    )

    const outcome = await readReadinessFile(repo)
    const notice = outcome.kind === 'usable' ? outcome.notice : null
    expect(notice?.message).toContain('1 other declared check')
    expect(notice?.message.length).toBeLessThanOrEqual(600)
  })

  // `stat` succeeds on a directory, so "the path exists" is not the same claim
  // as "the evidence can be opened". A directory named like the report satisfied
  // the first and not the second.
  it('rejects evidence that is a directory rather than a file', async () => {
    mkdirSync(join(repo, declaredPenTest.evidence), { recursive: true })
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(rejectedIds(outcome)).toEqual(['pen-test'])
  })

  it('rejects evidence that resolves outside the repository through a symlink', async () => {
    const secret = join(dirname(repo), 'outside-evidence.md')
    writeFileSync(secret, 'secret\n')
    mkdirSync(join(repo, 'docs', 'security'), { recursive: true })
    symlinkSync(secret, join(repo, declaredPenTest.evidence))
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(rejectedIds(outcome)).toEqual(['pen-test'])
  })

  it('raises no notice when every citation opens', async () => {
    putEvidence()
    put(
      READINESS_FILE_PATH,
      JSON.stringify({ schemaVersion: 1, checks: [declaredPenTest] }),
    )

    const outcome = await readReadinessFile(repo)
    expect(outcome.kind === 'usable' && outcome.notice).toBeNull()
    expect(rejectedIds(outcome)).toEqual([])
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
