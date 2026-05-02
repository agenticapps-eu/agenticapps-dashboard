import { defineConfig } from 'tsup'

// Banner injects a synthesized `require` for the bundled CJS deps (commander),
// so esbuild's ESM output can satisfy commander's internal `require('events')`
// against Node's real builtin module instead of the dynamic-require shim.
// Also keeps the shebang so the published bin works under `npx`.
const banner = [
  '#!/usr/bin/env node',
  'import { createRequire as __agentCreateRequire } from "node:module";',
  'const require = __agentCreateRequire(import.meta.url);',
].join('\n')

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  noExternal: ['@agenticapps/dashboard-shared', 'commander', 'zod'],
  banner: { js: banner },
})
