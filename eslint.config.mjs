import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginImport from 'eslint-plugin-import'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.vite/**',
      '.claude/worktrees/**',
      '.claude/skills/**',
      // Vendored upstream fork (D-5-21). Cherry-picks land here verbatim;
      // applying our lint rules would churn upstream-style code and break sync.
      'packages/agentlinter/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { import: pluginImport },
    rules: {
      'import/order': ['warn', { 'newlines-between': 'always' }],
      'import/no-duplicates': 'error',
      // Honor the underscore-prefix convention already used across the codebase
      // (e.g. `_opts` on scanner callbacks, `_omit` in destructuring discards) for
      // intentionally-unused identifiers. Without this override, the default
      // @typescript-eslint/no-unused-vars rule flags every `_`-prefixed name as
      // an error, contradicting the project's own convention.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
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
