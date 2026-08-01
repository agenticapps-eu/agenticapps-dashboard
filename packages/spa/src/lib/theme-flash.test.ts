// @vitest-environment node
/**
 * theme-flash.test.ts — the appearance is resolved before the first paint.
 *
 * `initTheme()` runs after the module graph evaluates, and `global.css` is
 * render-blocking ahead of it with the LIGHT palette in `@theme`. A dark user
 * therefore painted warm paper and light UA chrome before the `.dark` class
 * landed. The fix is an inline script in `index.html`; the risk is that it and
 * `lib/theme.ts` drift apart, because nothing imports one from the other.
 *
 * This test is the seam. It parses both files and asserts they agree on the
 * three things that make the pre-paint decision: the storage key, the default,
 * and how `system` resolves.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
const themeTs = readFileSync(resolve(__dirname, './theme.ts'), 'utf8')

/** The inline script, isolated from the rest of the document. */
const inlineScript = (() => {
  const m = indexHtml.match(/<script>([\s\S]*?)<\/script>/)
  return m ? m[1] : ''
})()

describe('the appearance is resolved before first paint', () => {
  it('index.html carries an inline (non-module) theme script', () => {
    expect(inlineScript, 'no inline <script> in index.html').not.toBe('')
    expect(inlineScript).toMatch(/classList\.add\('dark'\)/)
  })

  it('resolves before the app module, which is what makes it pre-paint', () => {
    // A deferred module script runs after the document parses and after
    // render-blocking CSS; only an inline script ahead of it beats the paint.
    expect(indexHtml.indexOf('<script>')).toBeLessThan(indexHtml.indexOf('type="module"'))
    expect(inlineScript).not.toMatch(/\btype\s*=\s*["']module["']/)
  })

  it('reads the same storage key as lib/theme.ts', () => {
    const key = themeTs.match(/const KEY = '([^']+)'/)?.[1]
    expect(key, 'lib/theme.ts no longer declares KEY the way this test parses it').toBeTruthy()
    expect(inlineScript).toContain(`'${key as string}'`)
  })

  it('defaults to dark, as D-02 and readChoice() do', () => {
    // readChoice() treats anything that is not 'light'/'system' as 'dark'.
    expect(themeTs).toMatch(/raw === 'light' \|\| raw === 'system' \? raw : 'dark'/)
    expect(inlineScript).toMatch(/!==\s*'light'\s*&&\s*c\s*!==\s*'system'/)
    expect(inlineScript).toMatch(/c\s*=\s*'dark'/)
  })

  it("resolves 'system' through the same media query as applyTheme()", () => {
    const mq = '(prefers-color-scheme: dark)'
    expect(themeTs).toContain(mq)
    expect(inlineScript).toContain(mq)
  })

  it('cannot block the render when localStorage throws', () => {
    // Safari private mode throws on getItem; an uncaught throw here would leave
    // the document unstyled rather than merely light.
    expect(inlineScript).toMatch(/try\s*\{/)
    expect(inlineScript).toMatch(/catch/)
  })
})
