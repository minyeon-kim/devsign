import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from 'cn'
import { openFiles } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'
import EditorMinimap from '@/components/dockview/panels/EditorMinimap'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'
import LocalCursor from '@/components/collab/LocalCursor'

const languageLabels = {
  jsx: 'JavaScript JSX',
  css: 'CSS',
  json: 'JSON',
  python: 'Python',
}

function CodeLine({ line, language, lineNumber, isActive, onSelect }) {
  const tokens = tokenizeLine(line, language)

  return (
    <div
      onClick={() => onSelect(lineNumber, line.length + 1)}
      className={cn(
        'flex cursor-text gap-4 px-4 hover:bg-muted/40',
        isActive && 'bg-muted/60'
      )}
    >
      <span className="w-6 shrink-0 text-right text-muted-foreground/50 select-none">
        {lineNumber}
      </span>
      <span className="whitespace-pre">
        {line.length === 0 ? (
          ' '
        ) : (
          tokens.map((token, i) => (
            <span key={i} className={tokenClassName(token.type)}>
              {token.text}
            </span>
          ))
        )}
      </span>
    </div>
  )
}

function EditorPanel() {
  const { activeFileId, setActiveFileId, getFileLines } = useWorkspace()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [copied, setCopied] = useState(false)
  const [viewport, setViewport] = useState({ top: 0, height: 1 })
  const codeAreaRef = useRef(null)
  const cursorAreaRef = useRef(null)

  const activeFile = openFiles.find((file) => file.id === activeFileId) ?? openFiles[0]
  const activeLines = getFileLines(activeFile.id)

  useEffect(() => {
    setCursor({ line: 1, col: 1 })
  }, [activeFileId])

  function updateViewport() {
    const el = codeAreaRef.current
    if (!el || el.scrollHeight === 0) return
    setViewport({
      top: el.scrollTop / el.scrollHeight,
      height: el.clientHeight / el.scrollHeight,
    })
  }

  useEffect(() => {
    updateViewport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLines])

  function jumpToRatio(ratio) {
    const el = codeAreaRef.current
    if (!el) return
    el.scrollTop = ratio * el.scrollHeight
    updateViewport()
  }

  function selectCursor(line, col) {
    setCursor({ line, col })
  }

  function copyCode() {
    const text = activeLines.join('\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-background font-mono">
      <div className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b bg-card px-2 font-sans">
        {openFiles.map((file) => {
          const { Icon, colorClass } = getFileIconMeta(file.name)
          const active = activeFileId === file.id
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveFileId(file.id)}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors',
                active
                  ? 'bg-muted text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', colorClass)} />
              {file.name}
            </button>
          )
        })}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-b bg-card/60 px-3 font-sans text-[11px] text-muted-foreground">
        <span className="truncate">{activeFile?.path}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Saved
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 rounded hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div ref={cursorAreaRef} className="force-cursor-none relative flex min-h-0 flex-1">
        <div
          ref={codeAreaRef}
          onScroll={updateViewport}
          className="flex-1 overflow-auto py-2 text-xs leading-relaxed"
        >
          {activeLines.map((line, i) => (
            <CodeLine
              key={i}
              line={line}
              language={activeFile.language}
              lineNumber={i + 1}
              isActive={cursor.line === i + 1}
              onSelect={selectCursor}
            />
          ))}
        </div>
        <EditorMinimap
          lines={activeLines}
          language={activeFile.language}
          viewport={viewport}
          onJump={jumpToRatio}
        />
        <MultiplayerCursors />
        <LocalCursor containerRef={cursorAreaRef} />
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between border-t bg-card px-3 font-sans text-[11px] text-muted-foreground">
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <div className="flex items-center gap-3">
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span>{languageLabels[activeFile?.language] ?? 'Plain Text'}</span>
        </div>
      </div>
    </div>
  )
}

export default EditorPanel
