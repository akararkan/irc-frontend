import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // The lint suite doesn't ship with React JSX awareness (we don't
      // pull in eslint-plugin-react), so a variable that's only used
      // as a JSX element — `motion.div`, `<Icon />` from a destructured
      // arg, etc. — would otherwise look unused. The patterns below
      // exempt the conventional JSX namespace names plus a leading-
      // underscore convention for intentionally-unused args.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]|^motion$',
        argsIgnorePattern: '^[A-Z_]|^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // The new react-hooks/purity rule flags `Date.now()` and
      // `Math.random()` inside event handlers (e.g. handleTap) as
      // "called during render". Those calls run in the click path,
      // not the render path, and are the canonical way to generate
      // per-event timestamps and ids.
      'react-hooks/purity': 'off',
      // useMemo's manual-memoization lint demands inline functions
      // for callers like `useMemo(isMacLike, [])`. The pattern is
      // intentional — referencing a stable top-level helper is more
      // readable than inlining it.
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: ['src/components/ui/**/*.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Context files conventionally export both the Provider and a
    // bouquet of hooks (`useFoo`, `useFooState`, …). Splitting them
    // across files just to please react-refresh costs more than it
    // saves — HMR still works for the Provider; the consumer hooks
    // are stateless re-exports and a full reload on edit is fine.
    files: ['src/features/**/*-context.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
