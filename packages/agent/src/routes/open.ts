/**
 * open.ts — POST /api/projects/:id/open, the editor exception.
 *
 * `filesystem-access-policy` enumerates four permitted process-spawn surfaces
 * and this is the first of them. That section is also explicit about how far
 * the guarantee reaches: the daemon runs a program it does not control, so it
 * SHALL guarantee only what it can enforce at the spawn boundary — the program
 * invoked, its arguments, its working directory, its resource bounds, and its
 * termination — and SHALL NOT assert what the spawned program then does to the
 * filesystem. Everything below is that boundary and nothing more.
 *
 * What the daemon enforces here:
 *
 * - The path is resolved by `resolveAllowed`, the same primitive the read route
 *   uses. No new filesystem reach is introduced; a path this route will open is
 *   a path the read route would already have served.
 * - `$EDITOR` is read as a command line and the resolved path is appended last.
 *   See `splitEditor` for why splitting is safe and for the one shape it has to
 *   handle specially.
 * - No shell. `shell: false` is explicit rather than relied upon as a default,
 *   because the whole safety of the argv discipline rests on it: it is what
 *   makes an `$EDITOR` token a literal argument rather than something the
 *   system interprets.
 * - The daemon does not wait. It answers 200 once the spawn is issued and
 *   unrefs the child, so a long-lived editor cannot hold the process open.
 */
import { spawn } from 'node:child_process'
import { statSync, accessSync, constants as fsConstants } from 'node:fs'

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context } from 'hono'

import { DEV_ORIGIN, PROD_ORIGIN } from '../constants.js'
import { agentError } from '../lib/logging.js'
import { resolveAllowed } from '../lib/paths.js'
import { readRegistry } from '../lib/registry.js'
import type { Env } from '../server/app.js'

/**
 * An omitted path means the project root — what "open in editor" means on a
 * repo detail header. The root is not under the read allow-list and is not
 * being added to it: that list bounds what the daemon reads out and hands to a
 * browser, and this route reads nothing and returns nothing. What bounds the
 * root is the registry, which holds only paths the user registered.
 *
 * A path that IS named keeps every restriction the read route applies.
 */
const OpenBodySchema = z.object({ path: z.string().min(1).optional() })

function requestId(c: Context): string {
  return (c.get('requestId') as string | undefined) ?? 'unknown'
}

/**
 * `$EDITOR` as argv. It is a command line by convention, not a bare program —
 * `zed --wait`, `code -w` and `subl -n` are the ordinary shapes, and refusing
 * them refuses nearly everyone.
 *
 * Splitting is safe here for the reason that mattered all along: `shell: false`
 * means no token produced by this function is ever interpreted — no globbing,
 * no substitution, no operators — and `$EDITOR` is the operator's own
 * environment, which is trusted input by the same rule that trusts a CLI flag.
 *
 * The one shape whitespace-splitting gets wrong is a program whose *path*
 * contains a space, which on macOS is not exotic:
 * `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code` is one
 * program with no arguments. So an `$EDITOR` that names an executable file
 * outright is taken whole, and only what is left is split.
 */
function splitEditor(editor: string): [string, ...string[]] {
  try {
    if (statSync(editor).isFile()) {
      accessSync(editor, fsConstants.X_OK)
      return [editor]
    }
  } catch {
    // Not a path to an executable file — a bare name resolved through PATH, or
    // a command line. Both are handled by splitting.
  }
  const [program, ...rest] = editor.split(/\s+/)
  return [program as string, ...rest]
}

export const openRoute = new Hono<Env>()

openRoute.post(
  '/:id/open',
  // A state-changing route checks Origin explicitly as well as through the CORS
  // middleware: the middleware governs what a browser will read, this governs
  // what the daemon will do. Mirrors the readiness rescan POST.
  async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin && origin !== PROD_ORIGIN && origin !== DEV_ORIGIN) {
      return c.json({ ok: false, error: 'origin_not_allowed', requestId: requestId(c) }, 403)
    }
    await next()
  },
  zValidator('json', OpenBodySchema, (result, c) => {
    if (!result.success) {
      return c.json({ ok: false, error: 'invalid_request', requestId: requestId(c) }, 422)
    }
  }),
  async (c) => {
    const { id } = c.req.param()
    const { path: relPath } = c.req.valid('json')

    const registryFile = c.get('registryFile') as string | undefined
    const project = readRegistry(registryFile).projects.find((p) => p.id === id)
    if (!project) {
      return c.json({ ok: false, error: 'project_not_found', requestId: requestId(c) }, 404)
    }

    // Answered before the path is touched: an unset EDITOR is a fact about this
    // machine, not about the request, and guessing an editor would be the
    // daemon choosing a program to run on the user's behalf.
    const editor = (process.env.EDITOR ?? '').trim()
    if (editor === '') {
      return c.json({ ok: false, error: 'editor_not_configured', requestId: requestId(c) }, 409)
    }
    const [program, ...leadingArgs] = splitEditor(editor)

    // Throws PathViolation → errorHandler → 422 path_not_allowed, exactly as on
    // the read route. The root itself is already canonical — the registry
    // realpath'd it at registration — so it needs no resolution, only the
    // absence of a path to name it.
    const real =
      relPath === undefined ? project.root : await resolveAllowed(project.root, relPath)

    const child = spawn(program, [...leadingArgs, real], {
      cwd: project.root,
      shell: false,
      detached: true,
      stdio: 'ignore',
    })
    // `spawn` reports a failure to start asynchronously, by emitting 'error' —
    // a missing binary, an EDITOR that is not executable, or a `cwd` that no
    // longer exists because the registered root drifted. An EventEmitter with
    // no listener for 'error' rethrows, and here that is an uncaught exception
    // in the daemon.
    //
    // A daemon installed under launchd has a far thinner PATH than the login
    // shell that set EDITOR, so "resolves in my terminal, not in the service"
    // is the ordinary case rather than the exotic one. This request has already
    // answered 200 by then — the spec requires answering before the outcome is
    // known — so there is nobody left to tell, and it is logged and dropped.
    child.once('error', (err: Error) => {
      agentError(`editor spawn failed requestId=${requestId(c)} ${String(err)}`)
    })
    // Nothing is read back from it and nothing waits on it. Without this the
    // editor's lifetime becomes the daemon's.
    child.unref()

    return c.json({ ok: true, requestId: requestId(c) }, 200)
  },
)
