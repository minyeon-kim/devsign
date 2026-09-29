import { useEffect, useRef, useState } from 'react'
import {
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  CircleMinus,
  Copy,
  ArrowUp,
  Code2,
  Crosshair,
  FileCode,
  MessageCircle,
  Paperclip,
  Pin,
  RotateCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
import { getFileIconMeta } from '@/lib/fileIcons'
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
  const workspace = useWorkspace()
  const fileName = target?.kind === 'file'
    ? target.label
    : target?.fileId
      ? workspace.getFileName(target.fileId)
      : workspace.activeFileId
        ? workspace.getFileName(workspace.activeFileId)
        : null
  const { Icon } = getFileIconMeta(fileName ?? '')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] transition-colors',
          'bg-white/[0.07] text-slate-300 hover:bg-white/[0.11] hover:text-white'
        )}
      >
        <Icon className="size-3 shrink-0 text-slate-400" />
        <span className="truncate font-medium">{fileName ?? 'Choose a file'}</span>
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
    <div className="mt-2 w-[92%] rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06]', status.className)}>
          <StatusIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100">{changed ? result.title : status.label}</p>
          {result.target && <p className="truncate text-[10px] text-slate-500">{result.target.label}</p>}
        </div>
        <span className={cn('shrink-0 text-[10px] font-medium', status.className)}>{status.label}</span>
      </div>
      {changed && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">Draft · not merged</span>
            <span className="text-[10px] text-slate-500">
              {plural(result.fileCount, 'file')} · {plural(result.elementCount, 'element')}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {result.changes.map((c, i) => (
              <li key={i} className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-4 text-slate-300">
                <span className="size-1 shrink-0 rounded-full bg-emerald-300/80" />
                <span className="min-w-0 truncate">{c.summary}</span>
                <span className="shrink-0 truncate font-mono text-[10px] text-slate-500">
                  {c.fileName}{c.line ? `:${c.line}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {result.reviewItems.length > 0 && (
            <p className="mt-2 text-[10px] font-medium text-emerald-300">
              {plural(result.reviewItems.length, 'change')} ready for review
            </p>
          )}
          {result.note && <p className="mt-1 text-[11px] text-amber-400/90">{result.note}</p>}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {first && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-6 rounded-full border-white/10 bg-white/[0.04] px-2.5 text-[10px]"
                onClick={() => focusChange({ fileId: first.fileId, line: first.line, layerId: result.target?.layerId })}
              >
                View changes
              </Button>
            )}
            {result.reviewItems.length > 0 && (
              <Button
                type="button"
                size="xs"
                className="h-6 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 text-[10px] font-semibold text-slate-950"
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

function ActionButton({ label, pressed, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}
      className={cn('inline-flex size-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-slate-200 disabled:pointer-events-none disabled:opacity-30', pressed && 'bg-emerald-400/10 text-emerald-300')}>
      {children}
    </button>
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
  const [copiedId, setCopiedId] = useState(null)
  const [feedback, setFeedback] = useState({})
  // The checkpoint whose inline "Rollback here" was clicked (confirming).
  const [rollbackId, setRollbackId] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping])

  function handleSend(text = input) {
    if (!text.trim() || isAiTyping) return
    sendChatMessage(text, target)
    setInput('')
    setAttachments([])
    setCodeBlockMode(false)
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopiedId(message.id)
      window.setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1400)
    } catch {
      // Clipboard access can be unavailable in embedded or non-secure contexts.
    }
  }

  async function shareMessage(message) {
    try {
      if (navigator.share) await navigator.share({ text: message.text })
      else await copyMessage(message)
    } catch { /* Share was dismissed or unavailable. */ }
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

      <div className="relative flex min-h-0 flex-1">
        <div ref={listRef} className="scroll-fade-bottom flex-1 space-y-5 overflow-auto p-2">
        {chatMessages.map((message, index) => (
          <div key={message.id} className={cn('group/chat flex w-full flex-col gap-1.5', message.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              translate="no"
              className={cn(
                'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-6',
                message.role === 'user'
                  ? 'bg-[#0E1F1B] text-[#D1FAE5]'
                  : 'bg-slate-800/80 text-slate-200'
              )}
            >
              {message.text}
            </div>
            {message.role === 'user' ? message.target && (
              <div className="flex w-full items-center justify-end gap-1 px-1 text-[10px] text-slate-500">
                <span className="flex min-w-0 items-center gap-1 truncate">
                  <Crosshair className="size-2.5 shrink-0" />
                  <span className="truncate">{message.target.label}</span>
                </span>
              </div>
            ) : <div className="flex w-full items-center justify-start gap-1 px-1 opacity-0 transition-opacity group-hover/chat:opacity-100 focus-within:opacity-100">
              <ActionButton label={copiedId === message.id ? 'Copied' : 'Copy'} onClick={() => copyMessage(message)}>{copiedId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</ActionButton>
              <ActionButton label="Regenerate" disabled={isAiTyping || Boolean(message.historyId) || !chatMessages.slice(0, index).some((m) => m.role === 'user')} onClick={() => { const previous = chatMessages.slice(0, index).reverse().find((m) => m.role === 'user'); if (previous) sendChatMessage(previous.text, previous.target, { includeUser: false, replaceMessageId: message.id }) }}><RotateCw className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs up" pressed={feedback[message.id] === 'up'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'up' ? null : 'up' }))}><ThumbsUp className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs down" pressed={feedback[message.id] === 'down'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'down' ? null : 'down' }))}><ThumbsDown className="size-3.5" /></ActionButton>
              <ActionButton label="Share" onClick={() => shareMessage(message)}><Share2 className="size-3.5" /></ActionButton>
            </div>}
            {message.result && <ResultCard result={message.result} />}
            {message.historyId && <ChatCheckpoint historyId={message.historyId} onRollback={setRollbackId} />}
          </div>
        ))}
        {isAiTyping && <TypingBubble />}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 px-2 pt-3 pb-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestionIcons[suggestion.iconName]
          return (
            <button
              key={suggestion.id}
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSend(suggestion.prompt)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-emerald-400/30 hover:text-white disabled:opacity-50"
            >
              {Icon && <Icon className="size-3 text-emerald-300" />}
              {suggestion.label}
            </button>
          )
        })}
      </div>

      <div className="shrink-0 space-y-1.5 p-2">
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

        <div className="rounded-2xl border border-transparent bg-white/[0.035] transition-[border-color,box-shadow] duration-200 focus-within:border-emerald-400/35 focus-within:ring-2 focus-within:ring-emerald-400/15 focus-within:shadow-[0_0_18px_-8px_rgba(52,211,153,0.35)]">
          <div className="flex min-w-0 items-center px-3 pt-2">
            <TargetChip
              target={target}
              options={options}
              onPick={(option) => setChatTargetOverride({ key: option.key, selection: key })}
            />
          </div>
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
                className={cn(codeBlockMode && 'bg-emerald-400/10 text-emerald-300')}
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
                <Switch
                  checked={autoMode}
                  onCheckedChange={setAutoMode}
                  size="sm"
                  className="data-checked:bg-emerald-400 data-unchecked:bg-white/15"
                />
              </label>
              <Button
                type="button"
                size="icon"
                onClick={() => handleSend()}
                disabled={!input.trim() || !target}
                title={target ? 'Send' : 'Choose a target first'}
                className="size-8 rounded-full bg-[#0E201C] text-[#D1FAE5] shadow-[0_0_12px_-4px_rgba(52,211,153,0.22)] hover:bg-[#15302A] disabled:bg-white/[0.06] disabled:text-slate-500"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatConversation
