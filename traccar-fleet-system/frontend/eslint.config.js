import js from '@eslint/js';
import airbnb from 'eslint-config-airbnb';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'build/**',
      'coverage/**',
      'public/sw*.js',
      'public/workbox-*.js',
      'mapbox-gl-rtl-text.js',
      'switcher.js',
      'theme.js',
      'vite.config.js',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    plugins: {
      react,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      'react': {
        version: 'detect'
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      },
    },
    rules: {
      ...airbnb.rules,
      'max-len': 'off',
      'no-shadow': 'off',
      'no-return-assign': 'off',
      'no-param-reassign': 'off',
      'no-prototype-builtins': 'off',
      'object-curly-newline': 'off',
      'import/no-unresolved': ['warn', {
        ignore: ['\\.svg', 'virtual:']
      }],
      'react/function-component-definition': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': 'off',
    },
  },
];
