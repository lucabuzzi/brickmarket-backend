import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

// Every jsx-a11y recommended rule, downgraded to a warning: the backlog (see `npm run lint:a11y`) is
// fixed gradually, while the two alt rules below stay errors so images can never regress.
const a11yWarnings = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([name, cfg]) => {
    const level = Array.isArray(cfg) ? cfg[0] : cfg
    if (level === 'off' || level === 0) return [name, 'off'] // the preset keeps these disabled
    return [name, Array.isArray(cfg) ? ['warn', ...cfg.slice(1)] : 'warn']
  }),
)

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
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...a11yWarnings,
      // the label text of this project's checkboxes sits in nested <div><span> elements
      'jsx-a11y/label-has-associated-control': ['warn', { depth: 3 }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // WCAG 1.1.1: every <img> needs an alt (alt="" for decorative ones), never "image of ..."
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
    },
  },
])
