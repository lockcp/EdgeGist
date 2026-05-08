import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { Compartment, RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { ThemedToken } from '@shikijs/types'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

type CodeMirrorEditorProps = {
  colorMode: 'light' | 'dark'
  language: string
  maxHeight?: number | string
  minHeight: number
  onChange(value: string): void
  value: string
}

const setShikiDecorations = StateEffect.define<DecorationSet>()
const shikiDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(setShikiDecorations)) next = effect.value
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

const codeMirrorHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: 'var(--cm-keyword)' },
  { tag: tags.atom, color: 'var(--cm-atom)' },
  { tag: tags.bool, color: 'var(--cm-bool)' },
  { tag: tags.number, color: 'var(--cm-number)' },
  { tag: tags.literal, color: 'var(--cm-literal)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--cm-string)' },
  { tag: tags.regexp, color: 'var(--cm-regexp)' },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName), tags.attributeName, tags.labelName],
    color: 'var(--cm-property)',
  },
  { tag: tags.variableName, color: 'var(--cm-variable)' },
  { tag: tags.local(tags.variableName), color: 'var(--cm-variable-2)' },
  { tag: tags.standard(tags.variableName), color: 'var(--cm-standard)' },
  { tag: tags.special(tags.variableName), color: 'var(--cm-special)' },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--cm-function)',
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--cm-type)' },
  { tag: [tags.operator, tags.derefOperator, tags.arithmeticOperator, tags.logicOperator, tags.compareOperator], color: 'var(--cm-operator)' },
  { tag: [tags.punctuation, tags.separator], color: 'var(--cm-punctuation)' },
  { tag: [tags.bracket, tags.squareBracket, tags.paren, tags.brace], color: 'var(--cm-bracket)' },
  { tag: [tags.heading, tags.strong], color: 'var(--cm-heading)', fontWeight: '600' },
  { tag: tags.emphasis, color: 'var(--cm-emphasis)', fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--cm-link)', textDecoration: 'underline' },
  { tag: [tags.comment, tags.meta], color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: tags.invalid, color: 'var(--destructive)' },
])

export function CodeMirrorEditor({
  colorMode,
  language,
  maxHeight,
  minHeight,
  onChange,
  value,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const view = new EditorView({
      doc: value,
      parent: containerRef.current,
      extensions: [
        basicSetup,
        shikiDecorationField,
        EditorView.lineWrapping,
        languageCompartment.current.of([]),
        themeCompartment.current.of(codeMirrorTheme(colorMode, minHeight, maxHeight)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentValue = view.state.doc.toString()
    if (value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    let cancelled = false
    void loadCodeMirrorLanguageExtension(language).then((extension) => {
      if (cancelled || viewRef.current !== view) return
      view.dispatch({
        effects: languageCompartment.current.reconfigure(extension),
      })
    })

    return () => {
      cancelled = true
    }
  }, [language])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(codeMirrorTheme(colorMode, minHeight, maxHeight)),
    })
  }, [colorMode, maxHeight, minHeight])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const shikiLanguage = normalizeShikiLanguage(language)
    const content = view.state.doc.toString()
    if (!shikiLanguage || !content) {
      view.dispatch({ effects: setShikiDecorations.of(Decoration.none) })
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void highlightEditorTokens(content, shikiLanguage, colorMode)
        .then((tokens) => {
          if (cancelled || viewRef.current !== view) return
          if (view.state.doc.toString() !== content) return
          view.dispatch({ effects: setShikiDecorations.of(buildShikiDecorations(view, tokens)) })
        })
        .catch(() => {
          if (!cancelled && viewRef.current === view) {
            view.dispatch({ effects: setShikiDecorations.of(Decoration.none) })
          }
        })
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [colorMode, language, value])

  return <div className="codemirror-editor" ref={containerRef} />
}

function codeMirrorTheme(colorMode: 'light' | 'dark', minHeight: number, maxHeight?: number | string): Extension {
  const maxHeightValue = formatEditorSize(maxHeight ?? 'min(60vh, 640px)')

  return [
    EditorView.theme(
      {
        '&': {
          backgroundColor: 'var(--code)',
          color: 'var(--code-foreground)',
          fontSize: '0.8125rem',
          maxHeight: maxHeightValue,
          minHeight: `${minHeight}px`,
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          lineHeight: '1.55',
          maxHeight: maxHeightValue,
          minHeight: `${minHeight}px`,
          overflow: 'auto',
        },
        '.cm-content': {
          caretColor: 'var(--foreground)',
          minHeight: `${minHeight}px`,
          padding: '0.625rem 0',
        },
        '.cm-line': {
          padding: '0 0.75rem',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--code)',
          borderRight: '1px solid var(--border)',
          color: 'var(--muted-foreground)',
        },
        '.cm-activeLine': {
          backgroundColor: 'transparent',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: 'var(--muted-foreground)',
        },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor:
            colorMode === 'dark'
              ? 'hsl(var(--accent-h) var(--accent-s) 28%)'
              : 'hsl(var(--accent-h) var(--accent-s) 84%)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--foreground)',
        },
        '.cm-tooltip, .cm-panels': {
          backgroundColor: 'var(--card)',
          color: 'var(--card-foreground)',
          borderColor: 'var(--border)',
        },
        '.cm-line span:not(.cm-shiki-token)': {
          color: 'inherit !important',
          fontStyle: 'inherit !important',
          fontWeight: 'inherit !important',
          textDecoration: 'inherit !important',
        },
        '.cm-shiki-token *': {
          color: 'inherit !important',
          fontStyle: 'inherit !important',
          fontWeight: 'inherit !important',
          textDecoration: 'inherit !important',
        },
      },
      { dark: colorMode === 'dark' },
    ),
    syntaxHighlighting(codeMirrorHighlightStyle),
  ]
}

function formatEditorSize(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value
}

async function loadCodeMirrorLanguageExtension(language: string): Promise<Extension> {
  switch (language) {
    case 'bash': {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell')
      return StreamLanguage.define(shell)
    }
    case 'c': {
      const { c } = await import('@codemirror/legacy-modes/mode/clike')
      return StreamLanguage.define(c)
    }
    case 'cpp': {
      const { cpp } = await import('@codemirror/lang-cpp')
      return cpp()
    }
    case 'csharp': {
      const { csharp } = await import('@codemirror/legacy-modes/mode/clike')
      return StreamLanguage.define(csharp)
    }
    case 'css':
    case 'scss': {
      const { css } = await import('@codemirror/lang-css')
      return css()
    }
    case 'go': {
      const { go } = await import('@codemirror/legacy-modes/mode/go')
      return StreamLanguage.define(go)
    }
    case 'html': {
      const { html } = await import('@codemirror/lang-html')
      return html()
    }
    case 'ini': {
      const { properties } = await import('@codemirror/legacy-modes/mode/properties')
      return StreamLanguage.define(properties)
    }
    case 'java': {
      const { java } = await import('@codemirror/lang-java')
      return java()
    }
    case 'js': {
      const { javascript } = await import('@codemirror/lang-javascript')
      return javascript()
    }
    case 'json':
    case 'jsonc': {
      const { json } = await import('@codemirror/lang-json')
      return json()
    }
    case 'jsx': {
      const { javascript } = await import('@codemirror/lang-javascript')
      return javascript({ jsx: true })
    }
    case 'markdown': {
      const { markdown } = await import('@codemirror/lang-markdown')
      return markdown()
    }
    case 'php': {
      const { php } = await import('@codemirror/lang-php')
      return php()
    }
    case 'python': {
      const { python } = await import('@codemirror/lang-python')
      return python()
    }
    case 'ruby': {
      const { ruby } = await import('@codemirror/legacy-modes/mode/ruby')
      return StreamLanguage.define(ruby)
    }
    case 'rust': {
      const { rust } = await import('@codemirror/lang-rust')
      return rust()
    }
    case 'sql': {
      const { sql } = await import('@codemirror/lang-sql')
      return sql()
    }
    case 'toml': {
      const { toml } = await import('@codemirror/legacy-modes/mode/toml')
      return StreamLanguage.define(toml)
    }
    case 'ts': {
      const { javascript } = await import('@codemirror/lang-javascript')
      return javascript({ typescript: true })
    }
    case 'tsx': {
      const { javascript } = await import('@codemirror/lang-javascript')
      return javascript({ jsx: true, typescript: true })
    }
    case 'xml': {
      const { xml } = await import('@codemirror/lang-xml')
      return xml()
    }
    case 'yaml': {
      const { yaml } = await import('@codemirror/lang-yaml')
      return yaml()
    }
    default:
      return []
  }
}

const shikiLanguageLoaders = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  go: () => import('@shikijs/langs/go'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  js: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  jsx: () => import('@shikijs/langs/jsx'),
  markdown: () => import('@shikijs/langs/markdown'),
  php: () => import('@shikijs/langs/php'),
  python: () => import('@shikijs/langs/python'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  scss: () => import('@shikijs/langs/scss'),
  sql: () => import('@shikijs/langs/sql'),
  toml: () => import('@shikijs/langs/toml'),
  ts: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
} as const

const shikiLanguageAliases: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  javascript: 'js',
  typescript: 'ts',
  shell: 'bash',
  sh: 'bash',
  yml: 'yaml',
  zsh: 'bash',
  plain: 'text',
  plaintext: 'text',
}

let editorHighlighterPromise: ReturnType<typeof createHighlighterCore> | null = null

function normalizeShikiLanguage(language: string) {
  const normalized = language.trim().toLowerCase().replace(/\s+/g, '-')
  const mapped = shikiLanguageAliases[normalized] ?? normalized
  if (mapped === 'text') return null
  return Object.prototype.hasOwnProperty.call(shikiLanguageLoaders, mapped) ? mapped : null
}

async function highlightEditorTokens(
  content: string,
  language: string,
  colorMode: 'light' | 'dark',
): Promise<ThemedToken[][]> {
  const highlighter = await getEditorCodeHighlighter()
  return highlighter.codeToTokens(content, {
    lang: language,
    theme: editorCodeTheme(colorMode),
  }).tokens
}

function buildShikiDecorations(view: EditorView, tokens: ThemedToken[][]) {
  const builder = new RangeSetBuilder<Decoration>()
  const docLength = view.state.doc.length
  for (const line of tokens) {
    for (const token of line) {
      if (!token.color || !token.content) continue
      const from = Math.max(0, Math.min(token.offset, docLength))
      const to = Math.max(from, Math.min(token.offset + token.content.length, docLength))
      if (to <= from) continue
      builder.add(from, to, Decoration.mark({ class: 'cm-shiki-token', attributes: { style: shikiTokenStyle(token) } }))
    }
  }
  return builder.finish()
}

function shikiTokenStyle(token: ThemedToken) {
  const styles = [`color: ${token.color} !important`]
  const fontStyle = token.fontStyle ?? 0
  if ((fontStyle & 1) === 1) styles.push('font-style: italic !important')
  if ((fontStyle & 2) === 2) styles.push('font-weight: 600 !important')
  if ((fontStyle & 4) === 4) styles.push('text-decoration: underline !important')
  return styles.join('; ')
}

function getEditorCodeHighlighter() {
  if (!editorHighlighterPromise) {
    editorHighlighterPromise = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: Object.values(shikiLanguageLoaders),
      themes: [
        () => import('@shikijs/themes/github-dark-default'),
        () => import('@shikijs/themes/github-light-default'),
      ],
      warnings: false,
    })
  }

  return editorHighlighterPromise
}

function editorCodeTheme(colorMode: 'light' | 'dark') {
  return colorMode === 'dark' ? 'github-dark-default' : 'github-light-default'
}
