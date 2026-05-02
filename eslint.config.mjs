import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginImport from 'eslint-plugin-import'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.vite/**'],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { import: pluginImport },
    rules: {
      'import/order': ['warn', { 'newlines-between': 'always' }],
      'import/no-duplicates': 'error',
    },
  },
  // SPA React rules (Plan 03 fills out the matching files)
  {
    files: ['packages/spa/**/*.{ts,tsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  // Agent CLI overrides — process.exit + console.log are intentional in CLI binaries
  // (Plan 02 fills out the matching files)
  {
    files: ['packages/agent/src/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-process-exit': 'off',
    },
  },
  // Prettier MUST be last — disables conflicting rules
  eslintConfigPrettier,
)
