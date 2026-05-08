import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { FileTree, useFileTree } from '@pierre/trees/react'
import { Plus } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

type FileTreePanelProps = {
  addLabel: string
  headerAction?: ReactNode
  paths: string[]
  searchPlaceholder: string
  selectedPath: string | null
  title: string
  onAdd?: () => void
  onSelect(path: string): void
}

export function FileTreePanel({
  addLabel,
  headerAction,
  paths,
  searchPlaceholder,
  selectedPath,
  title,
  onAdd,
  onSelect,
}: FileTreePanelProps) {
  const treeHostRef = useRef<HTMLDivElement | null>(null)
  const sortedPaths = useMemo(() => [...paths].sort((left, right) => left.localeCompare(right)), [paths])
  const initialSelectedPaths = selectedPath ? [selectedPath] : sortedPaths.slice(0, 1)
  const { model } = useFileTree({
    flattenEmptyDirectories: true,
    initialExpansion: 'open',
    initialSelectedPaths,
    onSelectionChange: (selectedPaths) => {
      const next = selectedPaths.find((path) => sortedPaths.includes(path))
      if (next) onSelect(next)
    },
    paths: sortedPaths,
    search: true,
    unsafeCSS: `
      :host {
        --trees-bg-override: transparent;
        --trees-bg-muted-override: var(--muted);
        --trees-fg-override: var(--foreground);
        --trees-fg-muted-override: var(--muted-foreground);
        --trees-search-bg-override: var(--background);
        --trees-search-fg-override: var(--foreground);
        --trees-selected-bg-override: var(--accent);
        --trees-selected-fg-override: var(--accent-foreground);
        --trees-border-color-override: var(--border);
        --trees-selected-focused-border-color-override: var(--ring);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      input[data-file-tree-search-input] {
        background: var(--background);
        border: 1px solid var(--input);
        color: var(--foreground);
        margin-top: 12px;
      }
      input[data-file-tree-search-input]::placeholder {
        color: var(--muted-foreground);
      }
      button[data-type='item'] {
        border-radius: 6px;
        cursor: pointer;
      }
    `,
  })

  useEffect(() => {
    const container = treeHostRef.current
    if (!container) return

    let shadowObserver: MutationObserver | null = null
    const timeoutIds: number[] = []
    const frameIds: number[] = []

    const setPlaceholder = () => {
      const host = container.querySelector<HTMLElement>('file-tree-container')
      const shadowRoot = host?.shadowRoot
      const input = shadowRoot?.querySelector<HTMLInputElement>('input[data-file-tree-search-input]')
      if (input && input.placeholder !== searchPlaceholder) input.placeholder = searchPlaceholder

      if (shadowRoot && !shadowObserver && typeof MutationObserver !== 'undefined') {
        shadowObserver = new MutationObserver(setPlaceholder)
        shadowObserver.observe(shadowRoot, {
          attributeFilter: ['placeholder'],
          attributes: true,
          childList: true,
          subtree: true,
        })
      }
    }

    setPlaceholder()
    frameIds.push(window.requestAnimationFrame(setPlaceholder))
    for (const delay of [50, 150, 500, 1000]) {
      timeoutIds.push(window.setTimeout(setPlaceholder, delay))
    }

    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(setPlaceholder)
    observer?.observe(container, { childList: true, subtree: true })

    return () => {
      observer?.disconnect()
      shadowObserver?.disconnect()
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId))
    }
  }, [searchPlaceholder, sortedPaths])

  return (
    <Card className="file-tree-panel min-h-0 self-start overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle>{title}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
          {onAdd ? (
            <Button type="button" variant="outline" size="icon" onClick={onAdd} title={addLabel} aria-label={addLabel}>
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent ref={treeHostRef} className="p-0">
        <FileTree key={sortedPaths.join('\n')} model={model} style={{ height: 'var(--edgegist-file-tree-height)' }} />
      </CardContent>
    </Card>
  )
}
