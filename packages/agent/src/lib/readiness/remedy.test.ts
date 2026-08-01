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

  it('never renders a machine path', () => {
    for (const { id, status } of EVERY_CELL) {
      for (const host of [...HOSTS, null]) {
        expect(
          /(^|[\s"'`([<])(\/|[A-Za-z]:[\\/])/.test(remedyFor(id, status, host)),
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

    it('names no tool in any state', () => {
      const tools =
        /burp|zap\b|nmap|metasploit|nessus|nuclei|semgrep|snyk|trivy|pentera/i
      for (const status of CHECK_STATUSES) {
        for (const host of [...HOSTS, null]) {
          expect(tools.test(remedyFor('pen-test', status, host))).toBe(false)
        }
      }
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
