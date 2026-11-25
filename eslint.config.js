/**
 * ESLint 配置（扁平配置格式）
 *
 * 【它做什么】检查代码里明显的笔误：用了没定义的变量、Vue 模板写错、
 *   空的 if 分支之类。你不用背规则，`npm run lint` 会告诉你哪儿有问题。
 *
 * 【想关掉某条规则】在下面 rules 里写 '规则名': 'off'。
 */
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import prettierConfig from '@vue/eslint-config-prettier'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-ssg/**',
      'src/generated/**',
      'public/**',
      'pagefind/**',
      '.zcode/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Vue 文件：用 vue-eslint-parser 解析 <template>，内部 <script> 交给 TS 解析器
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },

  // 浏览器 / Node 全局变量
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        matchMedia: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        CustomEvent: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },

  // 项目自定义：宽松一点，别让格式问题变成报错
  {
    rules: {
      // TypeScript 自己会检查"变量有没有定义"，这条基础规则会把
      // HTMLDivElement、PointerEvent 这些类型名误报成未定义，所以关掉。
      'no-undef': 'off',
      // 组件名允许单个单词（Home.vue、Posts.vue 这种）
      'vue/multi-word-component-names': 'off',
      // 属性换行、自闭合这类纯格式问题交给 Prettier
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-quotes': 'off',
      'vue/mustache-interpolation-spacing': 'off',
      'vue/no-v-html': 'off',
      // 未使用变量改成警告，下划线开头视为故意忽略
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许在脚本里用 console 输出构建进度
      'no-console': 'off',
      // 允许空的 catch（有些地方故意忽略错误）
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Prettier 放最后：关掉所有和格式冲突的规则
  prettierConfig,
]
