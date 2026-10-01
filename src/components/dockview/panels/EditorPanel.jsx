import { useContext, useEffect, useRef, useState } from 'react'
import { ChevronRight, MessageSquarePlus, Save, Send, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { allPeople } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'
import EditorMinimap from '@/components/dockview/panels/EditorMinimap'
import { RemoteCaretsOnLine, useRemoteCaretLines } from '@/components/collab/RemoteCarets'
import { WindowHeaderPortal, WindowTabsContext } from '@/components/workspace/WindowHeaderSlot'

const languageLabels = {
  jsx: 'JavaScript JSX',
  css: 'CSS',
  json: 'JSON',
  python: 'Python',
}

function CodeLine({ line, language, lineNumber, isActive, onSelect, pinCount, isPinOpen, onTogglePin }) {
  const tokens = tokenizeLine(line, language)
  const indentColumns = (line.match(/^[\t ]*/)?.[0] ?? '').replaceAll('\t', '  ').length

  return (
    <div
      onClick={() => onSelect(lineNumber, line.length + 1)}
      className={cn(
        'group flex cursor-text items-start gap-0 px-0 hover:bg-muted/40',
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
          'editor-line-comment mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-full transition-opacity hover:text-foreground',
          pinCount > 0 || isPinOpen
            ? 'text-emerald-300 opacity-100'
            : 'text-muted-foreground opacity-0 group-hover:opacity-100'
        )}
      >
        <MessageSquarePlus className="size-2.5" />
      </button>
      <span className="w-5 shrink-0 text-right text-muted-foreground/50 select-none">
        {lineNumber}
      </span>
      <span className="relative flex-1 whitespace-pre">
        {indentColumns >= 2 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0"
            style={{
              width: `${indentColumns}ch`,
              backgroundImage: 'repeating-linear-gradient(to right, transparent 0 calc(2ch - 1px), rgb(255 255 255 / 9%) calc(2ch - 1px) 2ch)',
            }}
          />
        )}
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
        <span className="mt-0.5 shrink-0 rounded-full bg-emerald-400/15 px-1.5 text-[9px] leading-4 font-medium text-emerald-200">
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
          className="ds-primary-cta flex size-7 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
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
  const {
    workspaceFiles,
    activeFileId,
    setActiveFileId,
    openFileIds,
    closeFileTab,
    getFileLines,
    getFileName,
    updateFileContent,
    comments,
    addComment,
    getViewersForFile,
    codeFlash,
    aiGenerating,
    draftChanges,
    editorDirtyFiles,
    setEditorDirtyFiles,
  } = useWorkspace()
  const tabsInHeader = useContext(WindowTabsContext)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [viewport, setViewport] = useState({ top: 0, height: 1 })
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [openLine, setOpenLine] = useState(null)
  const [lineDraft, setLineDraft] = useState('')
  const [flashLine, setFlashLine] = useState(null)
  const [generatingLine, setGeneratingLine] = useState(null)
  // A prototype file's content when editing started, so Cancel can undo
  // the live sync to the canvas.
  const editStartLines = useRef(null)
  const codeAreaRef = useRef(null)
  const cursorAreaRef = useRef(null)

  const activeFile = workspaceFiles.find((file) => file.id === activeFileId) ?? workspaceFiles[0]
  const activeLines = getFileLines(activeFile.id)
  // Teammates with this exact file open, as carets bound to its lines.
  const viewers = getViewersForFile(activeFile.id)
  const caretLines = useRemoteCaretLines(viewers, activeFile.id, activeLines)

  // Switching files while mid-edit or mid-comment would leave state pointed
  // at the wrong file, so just drop out of both — same as closing a file
  // with unsaved changes in a real editor without a save prompt.
  useEffect(() => {
    setCursor({ line: 1, col: 1 })
    setIsEditing(false)
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

  // A canvas edit or selection points here: scroll its line into view and
  // flash it (see WorkspaceProvider's codeFlash).
  useEffect(() => {
    if (!codeFlash || codeFlash.fileId !== activeFile.id) return
    setFlashLine(codeFlash.line)
    const frame = requestAnimationFrame(() => {
      codeAreaRef.current?.querySelector(`[data-line="${codeFlash.line}"]`)?.scrollIntoView({ block: 'nearest' })
    })
    const timer = window.setTimeout(() => setFlashLine(null), 1400)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [codeFlash, activeFile.id])

  // An AI edit is being "written" to this line — shimmer it and scroll it
  // into view before the change lands (see WorkspaceProvider's
  // `aiGenerating`); `codeFlash` above takes over once it actually does.
  useEffect(() => {
    if (!aiGenerating || aiGenerating.fileId !== activeFile.id || !aiGenerating.line) {
      setGeneratingLine(null)
      return
    }
    setGeneratingLine(aiGenerating.line)
    const frame = requestAnimationFrame(() => {
      codeAreaRef.current?.querySelector(`[data-line="${aiGenerating.line}"]`)?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [aiGenerating, activeFile.id])

  function startEditing() {
    editStartLines.current = activeLines
    setDraftText(activeLines.join('\n'))
    setIsEditing(true)
  }

  // Typing in a prototype file updates the canvas as you type (code →
  // design, live); other files apply on save.
  function changeDraft(text) {
    setDraftText(text)
    setEditorDirtyFiles((prev) => ({ ...prev, [activeFile.id]: text !== editStartLines.current?.join('\n') }))
    if (activeFile.prototype) updateFileContent(activeFile.id, text.split('\n'), { live: true })
  }

  function saveEditing() {
    updateFileContent(activeFile.id, draftText.split('\n'))
    setEditorDirtyFiles((prev) => ({ ...prev, [activeFile.id]: false }))
    setIsEditing(false)
  }

  function cancelEditing() {
    if (activeFile.prototype && editStartLines.current) {
      updateFileContent(activeFile.id, editStartLines.current, { live: true })
    }
    setEditorDirtyFiles((prev) => ({ ...prev, [activeFile.id]: false }))
    setIsEditing(false)
  }

  useEffect(() => () => {
    setEditorDirtyFiles((prev) => {
      if (!prev[activeFile.id]) return prev
      return { ...prev, [activeFile.id]: false }
    })
  }, [activeFile.id, setEditorDirtyFiles])

  return (
    <div className="flex h-full min-w-0 flex-col bg-card font-mono">
      {/* The open files' tabs sit on the window's title line, right after
          "Code Editor" (see WindowHeaderSlot) — only the ones you've opened;
          every file is in the file tree (the Files pane), not repeated here. */}
      {/* In a docked window the header draws these tabs itself (PanelTabs). */}
      {!tabsInHeader && (
      <WindowHeaderPortal fallbackClassName="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b bg-card px-2 font-sans">
        <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />
        {openFileIds.map((fileId) => {
          const name = getFileName(fileId)
          const { Icon, colorClass } = getFileIconMeta(name)
          const active = activeFileId === fileId
          return (
            <span
              key={fileId}
              className={cn(
                'group/tab relative flex h-7 shrink-0 items-center rounded-full text-xs transition-colors',
                active ? 'bg-muted text-foreground ring-1 ring-border' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <button type="button" onClick={() => setActiveFileId(fileId)} className={cn('flex h-full items-center gap-1.5 pl-2.5', openFileIds.length > 1 ? 'pr-8' : 'pr-2.5')}>
                <Icon className={cn('size-3.5 shrink-0', colorClass)} />
                {name}
                {(draftChanges[fileId] || editorDirtyFiles[fileId]) && <span className="ds-status-dot shrink-0 rounded-full bg-[#5EEAB5]" role="img" aria-label="Uncommitted or unsaved changes" />}
              </button>
              {openFileIds.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${name}`}
                  title="Close"
                  onClick={() => closeFileTab(fileId)}
                  className={cn(
                    'absolute top-1/2 right-1.5 -translate-y-1/2 flex size-4 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-150 motion-reduce:transition-none hover:bg-white/10 hover:text-foreground',
                    'pointer-events-none opacity-0 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100'
                  )}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          )
        })}
      </WindowHeaderPortal>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-7 shrink-0 items-center justify-between bg-transparent px-3 font-sans text-[11px] text-muted-foreground">
            <nav aria-label="File path" className="flex min-w-0 items-center overflow-hidden">
              {(activeFile?.path?.split(/[\\/]/).filter(Boolean) ?? []).map((part, index, parts) => (
                <span key={`${part}-${index}`} className="flex min-w-0 shrink-0 items-center">
                  {index > 0 && <ChevronRight aria-hidden="true" className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" />}
                  <span className={cn('truncate', index === parts.length - 1 && 'text-foreground/80')}>{part}</span>
                </span>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-3">
              {isEditing ? (
                <>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="ds-status-dot rounded-full bg-emerald-300" />
                    Editing
                  </span>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex items-center gap-1 rounded hover:text-foreground"
                  >
                    <X className="size-3" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEditing}
                    className="flex items-center gap-1 rounded text-emerald-300 hover:text-emerald-200"
                  >
                    <Save className="size-3" />
                    Done
                  </button>
                </>
              ) : null              }
            </div>
          </div>

          {isEditing ? (
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => changeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEditing()
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEditing()
              }}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-card px-2 py-2 text-xs leading-relaxed text-foreground outline-none"
            />
          ) : (
            <div ref={cursorAreaRef} className="force-cursor-none relative flex min-h-0 flex-1"
              tabIndex={0}
              aria-label="Code viewer. Double-click or press Enter to edit."
              onDoubleClick={(event) => { if (!event.target.closest('button')) startEditing() }}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && event.key === 'Enter') {
                  event.preventDefault()
                  startEditing()
                }
              }}
            >
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
                    <div
                      key={i}
                      data-line={lineNumber}
                      className={cn(
                        'relative overflow-hidden transition-colors duration-700',
                        flashLine === lineNumber && 'bg-emerald-400/15',
                        generatingLine === lineNumber && 'ai-gen-line'
                      )}
                    >
                      <RemoteCaretsOnLine
                        viewers={viewers.filter((v) => caretLines[v.id] === lineNumber)}
                        lineNumber={lineNumber}
                        lines={activeLines}
                      />
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
                      {generatingLine === lineNumber && (
                        <span className="ai-gen-badge pointer-events-none absolute top-0 right-2 z-10 flex items-center gap-1 rounded-full bg-[#0B0F0D] px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-emerald-300 ring-1 ring-emerald-400/30">
                          <Sparkles className="size-2.5 animate-pulse" />
                          AI
                        </span>
                      )}
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
            </div>
          )}

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
      </div>
    </div>
  )
}

export default EditorPanel
