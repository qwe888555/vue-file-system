import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  { ignores: ['dist/', 'node_modules/'] },

  // ── .vue 文件用 vue-eslint-parser 解析，script 内用 TS parser ──
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        sourceType: 'module',
      },
    },
  },

  // ── .ts 文件用 @typescript-eslint/parser ──
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
  },

  // ── Vue 推荐规则 ──
  ...pluginVue.configs['flat/essential'],

  // ── 自定义规则 ──
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // Vue
      'vue/multi-word-component-names': 'warn',
      'vue/no-mutating-props': 'error',
      'vue/no-v-html': 'warn',
      'vue/order-in-components': 'warn',

      // 通用
      'no-console': 'error',
      'no-debugger': 'error',
      'prefer-const': 'error',

      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
