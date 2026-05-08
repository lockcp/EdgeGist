import { createHighlighterCore } from '@shikijs/core'

export * from '@shikijs/core'
export { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } from '@shikijs/engine-javascript'
export { createOnigurumaEngine, loadWasm } from '@shikijs/engine-oniguruma'

export const createHighlighter = createHighlighterCore

export const bundledLanguages = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  go: () => import('@shikijs/langs/go'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  js: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  jsx: () => import('@shikijs/langs/jsx'),
  markdown: () => import('@shikijs/langs/markdown'),
  md: () => import('@shikijs/langs/markdown'),
  php: () => import('@shikijs/langs/php'),
  python: () => import('@shikijs/langs/python'),
  py: () => import('@shikijs/langs/python'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  scss: () => import('@shikijs/langs/scss'),
  sh: () => import('@shikijs/langs/bash'),
  shell: () => import('@shikijs/langs/bash'),
  sql: () => import('@shikijs/langs/sql'),
  toml: () => import('@shikijs/langs/toml'),
  ts: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
  yml: () => import('@shikijs/langs/yaml'),
  zsh: () => import('@shikijs/langs/bash'),
} as const

export const bundledLanguagesAlias = bundledLanguages
export const bundledLanguagesBase = bundledLanguages
export const bundledLanguagesInfo = Object.keys(bundledLanguages).map((id) => ({ id, aliases: [], name: id }))

export const bundledThemes = {
  'github-dark-default': () => import('@shikijs/themes/github-dark-default'),
  'github-light-default': () => import('@shikijs/themes/github-light-default'),
} as const

export const bundledThemesInfo = Object.keys(bundledThemes).map((id) => ({ id, displayName: id, type: 'dark' }))
