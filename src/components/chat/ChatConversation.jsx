import { useEffect, useRef, useState } from 'react'
import {
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  CircleMinus,
  Code2,
  Crosshair,
  FileCode,
  MessageCircle,
  Paperclip,
  Pin,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ChatCheckpoint from '@/components/history/ChatCheckpoint'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { aiModels, chatSuggestions, findCanvasTarget, forProject } from '@/data/mockData'
import { prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'

const suggestionIcons = { MessageCircle, Sparkles, Pin }

// ─── Request target ────────────────────────────────────────────────────
// What an AI request is about: the selected element, the current page, or
// the open file. It follows the current selection (so the chip never
// disagrees with what's selected) unless one was picked explicitly for
// this selection; with no element selected there's no default — you pick.
// The target is captured on the message when sent, and the AI only applies
// a change that lands inside it.

function targetOptions(workspace) {
  const { selectedLayerId, activePageId, activeFileId, projectPages, getFileName } = workspace
  const options = []
  const hit = selectedLayerId && findCanvasTarget(selectedLayerId)
  if (hit) {
    const name = hit.layer?.name ?? hit.frame?.name
    options.push({
      kind: 'element',
      key: `element:${selectedLayerId}`,
      layerId: selectedLayerId,
      pageId: hit.page.id,
      label: `${hit.page.name} → ${name}`,
    })
  }
  const page = projectPages.find((p) => p.id === activePageId)
  if (page) {
    options.push({
      kind: 'page',
      key: `page:${page.id}`,
      pageId: page.id,
      fileId: prototypeFileForPage(page.id)?.id,
      label: `${page.name} (whole page)`,
    })
  }
  if (activeFileId) {
    options.push({ kind: 'file', key: `file:${activeFileId}`, fileId: activeFileId, label: getFileName(activeFileId) })
  }
  return options
}

function selectionKey({ selectedLayerId, activePageId, activeFileId }) {
  return `${selectedLayerId ?? ''}|${activePageId ?? ''}|${activeFileId ?? ''}`
}

const TARGET_KIND_LABEL = { element: 'Selected element', page: 'Current page', file: 'Open file' }

function TargetChip({ target, options, onPick }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] transition-colors',
          target ? 'text-foreground/80 hover:bg-muted' : 'bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
        )}
      >
        <Crosshair className="size-3 shrink-0" />
        <span className="shrink-0 text-muted-foreground">Target:</span>
        <span className="truncate font-medium">{target ? target.label : 'Choose what to change'}</span>
        <ChevronDown className="size-2.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Apply the request to</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuItem key={option.key} onClick={() => onPick(option)} className="flex-col items-start gap-0">
              <span className="flex w-full items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {target?.key === option.key && <Check className="size-3.5 text-primary" />}
              </span>
              <span className="text-[10.5px] text-muted-foreground">{TARGET_KIND_LABEL[option.kind]}</span>
            </DropdownMenuItem>
          ))}
          {!options.some((o) => o.kind === 'element') && (
            <p className="px-2 py-1.5 text-[10.5px] text-muted-foreground">Select an element on the canvas to target it.</p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── AI result ─────────────────────────────────────────────────────────

const RESULT_STATUS = {
  done: { label: 'Done', icon: Check, className: 'text-emerald-400' },
  partial: { label: 'Partially done', icon: CircleAlert, className: 'text-amber-400' },
  no_change: { label: 'No changes made', icon: CircleMinus, className: 'text-muted-foreground' },
  failed: { label: 'Failed', icon: X, className: 'text-destructive' },
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// What an AI request actually did: status, the changes (file · line ·
// what), counts, and links into the existing paths — the changed code and
// element ("View changes") and the Conflict Point now awaiting review
// ("Review changes"). A request that changed nothing says so, and has no
// checkpoint.
function ResultCard({ result }) {
  const { focusChange, setBottomPanel, openConflictReview } = useWorkspace()
  const status = RESULT_STATUS[result.status] ?? RESULT_STATUS.done
  const StatusIcon = status.icon
  const changed = result.status === 'done' || result.status === 'partial'
  const first = result.changes?.[0]

  return (
    <div className="mt-1.5 w-[85%] rounded-2xl border bg-background px-3 py-2.5 text-xs">
      <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold', status.className)}>
        <StatusIcon className="size-3.5" />
        {status.label}
        {result.target && <span className="truncate font-normal text-muted-foreground">· {result.target.label}</span>}
      </p>
      {changed && (
        <>
          <p className="mt-1 font-medium text-foreground">{result.title}</p>
          <p className="mt-1 text-[11px] text-amber-300">Draft changes · Not merged</p>
          <ul className="mt-1.5 space-y-1">
            {result.changes.map((c, i) => (
              <li key={i} className="text-[11px] text-foreground/80">
                <span className="font-mono text-muted-foreground">
                  {c.fileName}
                  {c.line ? `:${c.line}` : ''}
                </span>{' '}
                {c.summary}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
            {plural(result.fileCount, 'file')} · {plural(result.elementCount, 'element')} ·{' '}
            <span className={cn(result.reviewItems.length > 0 && 'text-sky-400')}>
              {plural(result.reviewItems.length, 'review item')}
            </span>
          </p>
          {result.note && <p className="mt-1 text-[11px] text-amber-400/90">{result.note}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {first && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => focusChange({ fileId: first.fileId, line: first.line, layerId: result.target?.layerId })}
              >
                View changes
              </Button>
            )}
            {result.reviewItems.length > 0 && (
              <Button
                type="button"
                size="xs"
                onClick={() => {
                  setBottomPanel({ tab: 'conflict', open: true })
                  openConflictReview(result.reviewItems[0].conflictId)
                }}
              >
                Review changes
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  )
}

// The "Ask Devsign" conversation itself — suggestions, the messages (each
// AI change with its inline checkpoint and "Rollback here"), the composer —
// shared by the floating chat widget and the AI Chat pane, so both are the
// same conversation (the workspace's chat state) with the same controls.
function ChatConversation() {
  const workspace = useWorkspace()
  const {
    chatMessages,
    isAiTyping,
    sendChatMessage,
    projectId,
    chatDraft: input,
    setChatDraft: setInput,
    chatTargetOverride,
    setChatTargetOverride,
    workspaceFiles,
  } = workspace
  const options = targetOptions(workspace)
  const key = selectionKey(workspace)
  const picked = chatTargetOverride?.selection === key ? options.find((o) => o.key === chatTargetOverride.key) : null
  const target = picked ?? options.find((o) => o.kind === 'element') ?? null
  const suggestions = forProject(chatSuggestions, projectId)
  const attachablePool = workspaceFiles.map((f) => f.name)
  const [attachments, setAttachments] = useState([])
  const [codeBlockMode, setCodeBlockMode] = useState(false)
  const [model, setModel] = useState(aiModels[1] ?? aiModels[0])
  const [autoMode, setAutoMode] = useState(true)
  // The checkpoint whose inline "Rollback here" was clicked (confirming).
  const [rollbackId, setRollbackId] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping])

  function handleSend(text = input) {
    if (!text.trim() || !target) return
    sendChatMessage(text, target)
    setInput('')
    setAttachments([])
    setCodeBlockMode(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  function handleAttach() {
    setAttachments((prev) => {
      const next = attachablePool.find((f) => !prev.includes(f))
      return next ? [...prev, next] : prev
    })
  }

  function removeAttachment(name) {
    setAttachments((prev) => prev.filter((f) => f !== name))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RollbackCheckpointModal key={rollbackId} entryId={rollbackId} onOpenChange={(open) => !open && setRollbackId(null)} />

      <div className="flex shrink-0 flex-wrap gap-1.5 px-3 pt-1 pb-3">
        {suggestions.map((suggestion) => {
          const Icon = suggestionIcons[suggestion.iconName]
          return (
            <button
              key={suggestion.id}
              type="button"
              disabled={!target}
              title={target ? undefined : 'Choose a target first'}
              onClick={() => handleSend(suggestion.prompt)}
              className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {Icon && <Icon className="size-3 text-primary" />}
              {suggestion.label}
            </button>
          )
        })}
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-auto p-3">
        {chatMessages.map((message) => (
          <div key={message.id} className={cn('flex flex-col', message.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              translate="no"
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              )}
            >
              {message.text}
            </div>
            {message.role === 'user' && message.target && (
              <span className="mt-0.5 flex max-w-[85%] items-center gap-1 truncate text-[10.5px] text-muted-foreground">
                <Crosshair className="size-2.5 shrink-0" />
                {message.target.label}
              </span>
            )}
            {message.result && <ResultCard result={message.result} />}
            {message.historyId && <ChatCheckpoint historyId={message.historyId} onRollback={setRollbackId} />}
          </div>
        ))}
        {isAiTyping && <TypingBubble />}
      </div>

      <div className="shrink-0 space-y-1.5 border-t p-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachments.map((file) => (
              <span key={file} className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] text-foreground/80">
                <FileCode className="size-2.5" />
                {file}
                <button type="button" onClick={() => removeAttachment(file)}>
                  <X className="size-2.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex min-w-0 items-center px-1">
          <TargetChip
            target={target}
            options={options}
            onPick={(option) => setChatTargetOverride({ key: option.key, selection: key })}
          />
        </div>

        <div className="rounded-3xl border bg-background">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask Devsign to tweak the design or code..."
            className="w-full resize-none border-none bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon-xs" onClick={handleAttach}>
                <Paperclip className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setCodeBlockMode((v) => !v)}
                className={cn(codeBlockMode && 'bg-primary/10 text-primary')}
              >
                <Code2 className="size-3.5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Braces className="size-3" />
                  {model}
                  <ChevronDown className="size-2.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                    {aiModels.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Auto
                <Switch checked={autoMode} onCheckedChange={setAutoMode} size="sm" />
              </label>
              <Button
                type="button"
                size="icon"
                onClick={() => handleSend()}
                disabled={!input.trim() || !target}
                title={target ? 'Send' : 'Choose a target first'}
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatConversation
