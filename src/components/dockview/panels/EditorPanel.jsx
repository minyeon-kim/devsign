import { useEffect, useRef, useState } from 'react'
import { Check, Copy, MessageSquarePlus, Send, X } from 'lucide-react'
import { cn } from 'cn'
import { allPeople, openFiles } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'
import EditorMinimap from '@/components/dockview/panels/EditorMinimap'
import MultiplayerCursors from '@/components/collab/MultiplayerCursors'

const languageLabels = {
  jsx: 'JavaScript JSX',
  css: 'CSS',
  json: 'JSON',
  python: 'Python',
}

function CodeLine({ line, language, lineNumber, isActive, onSelect, pinCount, isPinOpen, onTogglePin }) {
  const tokens = tokenizeLine(line, language)

  return (
    <div
      onClick={() => onSelect(lineNumber, line.length + 1)}
      className={cn(
        'group flex cursor-text items-start gap-2 px-4 hover:bg-muted/40',
        isActive && 'bg-muted/60'
      )}
    >
      <button
        type="button"
        title="Comment on this line"
        onClick={(event) => {
          event.stopPropagation()
          onTogglePin(lineNumber)
        }}
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full transition-opacity hover:text-foreground',
          pinCount > 0 || isPinOpen
            ? 'text-primary opacity-100'
            : 'text-muted-foreground opacity-0 group-hover:opacity-100'
        )}
      >
        <MessageSquarePlus className="size-3" />
      </button>
      <span className="w-6 shrink-0 text-right text-muted-foreground/50 select-none">
        {lineNumber}
      </span>
      <span className="flex-1 whitespace-pre">
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
      {pinCount > 0 && (
        <span className="mt-0.5 shrink-0 rounded-full bg-primary/15 px-1.5 text-[9px] leading-4 font-medium text-primary">
          {pinCount}
        </span>
      )}
    </div>
  )
}

// A GitHub-review-style inline thread that expands directly under a code
// line — existing pinned comments for that line, plus a composer to add
// another. Anchored to the line itself (not a floating popover) since the
// editor's code area already scrolls vertically as one column.
function LineCommentThread({ lineComments, value, onChange, onSubmit, onClose }) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="cursor-default border-y bg-card px-4 py-2.5 pl-12 font-sans"
    >
      <div className="space-y-2">
        {lineComments.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          return (
            <div key={comment.id} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white',
                  author?.colorClass
                )}
              >
                {author?.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{author?.name}</span>
                  <span className="text-[10px] text-muted-foreground">{comment.timeLabel}</span>
                </div>
                <p className="mt-0.5 leading-relaxed text-foreground/85">{comment.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
          placeholder="Reply..."
          className="h-7 flex-1 rounded-full border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function EditorPanel() {
  const { activeFileId, setActiveFileId, getFileLines, comments, addComment } = useWorkspace()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [copied, setCopied] = useState(false)
  const [viewport, setViewport] = useState({ top: 0, height: 1 })
  const [openLine, setOpenLine] = useState(null)
  const [lineDraft, setLineDraft] = useState('')
  const codeAreaRef = useRef(null)
  const cursorAreaRef = useRef(null) // still needed as the relative anchor for MultiplayerCursors

  const activeFile = openFiles.find((file) => file.id === activeFileId) ?? openFiles[0]
  const activeLines = getFileLines(activeFile.id)

  useEffect(() => {
    setCursor({ line: 1, col: 1 })
    setOpenLine(null)
    setLineDraft('')
  }, [activeFileId])

  function toggleLinePin(lineNumber) {
    setOpenLine((current) => (current === lineNumber ? null : lineNumber))
    setLineDraft('')
  }

  function submitLineComment(lineNumber) {
    if (!lineDraft.trim()) return
    addComment(lineDraft, { type: 'editor', fileId: activeFile.id, line: lineNumber })
    setLineDraft('')
  }

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
      {/* Chrome-style: one tab row. Each file's full path is a title-attr
          tooltip instead of a separate path sub-header, the "Saved" state is
          a small dot on the active tab, and Copy sits at the row's trailing
          edge — no second bar duplicating what the tabs already show. */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-card px-2 font-sans">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {openFiles.map((file) => {
            const { Icon, colorClass } = getFileIconMeta(file.name)
            const active = activeFileId === file.id
            return (
              <button
                key={file.id}
                type="button"
                title={file.path}
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
                {active && (
                  <span
                    title="Saved"
                    className="size-1.5 shrink-0 rounded-full bg-emerald-400"
                  />
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={copyCode}
          title="Copy file contents"
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div ref={cursorAreaRef} className="relative flex min-h-0 flex-1">
        <div
          ref={codeAreaRef}
          onScroll={updateViewport}
          className="flex-1 overflow-auto py-2 text-xs leading-relaxed"
        >
          {activeLines.map((line, i) => {
            const lineNumber = i + 1
            const lineComments = comments.filter(
              (c) =>
                c.target?.type === 'editor' &&
                c.target.fileId === activeFile.id &&
                c.target.line === lineNumber
            )
            return (
              <div key={i}>
                <CodeLine
                  line={line}
                  language={activeFile.language}
                  lineNumber={lineNumber}
                  isActive={cursor.line === lineNumber}
                  onSelect={selectCursor}
                  pinCount={lineComments.length}
                  isPinOpen={openLine === lineNumber}
                  onTogglePin={toggleLinePin}
                />
                {openLine === lineNumber && (
                  <LineCommentThread
                    lineComments={lineComments}
                    value={lineDraft}
                    onChange={setLineDraft}
                    onSubmit={() => submitLineComment(lineNumber)}
                    onClose={() => setOpenLine(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
        <EditorMinimap
          lines={activeLines}
          language={activeFile.language}
          viewport={viewport}
          onJump={jumpToRatio}
        />
        <MultiplayerCursors />
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
