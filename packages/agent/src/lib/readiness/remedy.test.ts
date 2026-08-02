import { describe, expect, it } from 'vitest'
import { CHECK_IDS, CHECK_STATUSES } from '@agenticapps/dashboard-shared'

import { HOST_UPDATE_COMMANDS, remedyFor } from './remedy.js'
import type { ReadinessHostId } from './workflowDeriver.js'

const HOSTS: readonly ReadinessHostId[] = ['claude', 'codex', 'opencode', 'pi']

/** Every id × status the detail surface can render, plus every host. */
const EVERY_CELL = CHECK_IDS.flatMap((id) =>
  CHECK_STATUSES.map((status) => ({ id, status })),
)

describe('remedyFor', () => {
  it('answers every check and status with a sentence', () => {
    for (const { id, status } of EVERY_CELL) {
      for (const host of [...HOSTS, null]) {
        const remedy = remedyFor(id, status, host)
        expect(remedy.trim(), `${id}/${status}/${host}`).not.toBe('')
        expect(remedy.length, `${id}/${status}/${host}`).toBeLessThanOrEqual(600)
      }
    }
  })

  /**
   * The shared sanitiser rejects any leading-slash token, which is why remedy
   * text is typed as RemedySchema and not SanitisedTextSchema: two hosts spell
   * their update command with a leading slash, and the spec requires the remedy
   * to name it. Those four commands are the whole exemption — strip them and
   * the sanitiser rule must still hold, so a real machine path cannot hide
   * behind it.
   */
  it('never renders a machine path, the four host commands excepted', () => {
    const commands = Object.values(HOST_UPDATE_COMMANDS)
    for (const { id, status } of EVERY_CELL) {
      for (const host of [...HOSTS, null]) {
        const stripped = commands.reduce(
          (text, command) => text.split(command).join('the update command'),
          remedyFor(id, status, host),
        )
        expect(
          /(^|[\s"'`([<])(\/|[A-Za-z]:[\\/])/.test(stripped),
          `${id}/${status}/${host}`,
        ).toBe(false)
      }
    }
  })

  it('never names a home or user directory', () => {
    for (const { id, status } of EVERY_CELL) {
      for (const host of [...HOSTS, null]) {
        expect(
          /\/Users\/|\/home\/|~\/|Sourcecode/.test(remedyFor(id, status, host)),
          `${id}/${status}/${host}`,
        ).toBe(false)
      }
    }
  })

  describe('the pen-test slot', () => {
    it('routes every status through the readiness file', () => {
      for (const status of CHECK_STATUSES) {
        expect(remedyFor('pen-test', status, 'claude')).toContain(
          '.agenticapps/readiness.json',
        )
      }
    })

    it('tells an expired declaration to renew, not to start', () => {
      const expired = remedyFor('pen-test', 'stale', 'claude')
      expect(expired).not.toBe(remedyFor('pen-test', 'never', 'claude'))
      expect(expired).toContain('expired')
    })

    it('names no tool in any state', () => {
      const tools =
        /burp|zap\b|nmap|metasploit|nessus|nuclei|semgrep|snyk|trivy|pentera/i
      for (const status of CHECK_STATUSES) {
        for (const host of [...HOSTS, null]) {
          expect(tools.test(remedyFor('pen-test', status, host))).toBe(false)
        }
      }
    })

    // The two `never`s reach opposite verdicts, so they cannot share remedy
    // text. Telling an author who has just declared "we have never tested" that
    // the check does not block would send them hunting for a blocker that is
    // the very check they are reading.
    it('does not tell a declared never that it fails to block', () => {
      const declared = remedyFor('pen-test', 'never', 'claude', 'declared')
      const derived = remedyFor('pen-test', 'never', 'claude', 'derived')

      expect(declared).not.toBe(derived)
      expect(declared).toContain('blocks')
      expect(declared).not.toContain('does not block')
      expect(derived).toContain('does not block')
    })

    it('tells a declared na that the check is excluded, not that it is missing', () => {
      const remedy = remedyFor('pen-test', 'na', 'claude', 'declared')
      expect(remedy).toContain('excluded')
      expect(remedy).not.toContain('does not block a ready verdict')
    })
  })

  describe('the spec slot on an unmigrated repo', () => {
    it.each(HOSTS)('names the %s host command and migration 0032', (host) => {
      const remedy = remedyFor('spec', 'never', host)
      expect(remedy).toContain(HOST_UPDATE_COMMANDS[host])
      expect(remedy).toContain('0032')
      expect(remedy).toContain('OpenSpec')
    })

    it('distinguishes the hosts rather than printing one command for all', () => {
      const rendered = new Set(HOSTS.map((h) => remedyFor('spec', 'never', h)))
      expect(rendered.size).toBe(HOSTS.length)
    })

    it('still names migration 0032 when no host was detected', () => {
      const remedy = remedyFor('spec', 'never', null)
      expect(remedy).toContain('0032')
      // No host means no command to name, never the wrong host's command.
      for (const host of HOSTS) {
        expect(remedy).not.toContain(HOST_UPDATE_COMMANDS[host])
      }
    })

    it('is not a bare migrate hint', () => {
      for (const host of HOSTS) {
        const remedy = remedyFor('spec', 'never', host)
        expect(remedy.toLowerCase()).not.toBe('migrate the repo.')
        expect(remedy.length).toBeGreaterThan(40)
      }
    })
  })

  describe('the workflow slot', () => {
    it('names the detected host command when the contract trails', () => {
      expect(remedyFor('workflow', 'fail', 'codex')).toContain(
        HOST_UPDATE_COMMANDS.codex,
      )
    })

    it('names the detected host command when only the skill version trails', () => {
      expect(remedyFor('workflow', 'warn', 'opencode')).toContain(
        HOST_UPDATE_COMMANDS.opencode,
      )
    })
  })

  describe('the coverage slot', () => {
    it('names the artifact the check reads when none exists', () => {
      expect(remedyFor('coverage', 'never', 'claude')).toContain(
        'coverage-summary.json',
      )
    })
  })

  describe('the review slots', () => {
    it('names the artifact each check matches', () => {
      expect(remedyFor('code-review', 'never', 'claude')).toContain('REVIEW.md')
      expect(remedyFor('security-review', 'never', 'claude')).toContain(
        'SECURITY.md',
      )
    })

    it('asks for a re-review rather than a first review when stale', () => {
      expect(remedyFor('code-review', 'stale', 'claude')).not.toBe(
        remedyFor('code-review', 'never', 'claude'),
      )
    })
  })
})
