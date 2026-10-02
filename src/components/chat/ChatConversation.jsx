import { documentTarget } from '@/lib/workspaceDocuments'
import { useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'
import '@/components/chat/ChatSubmitButton.css'
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
  FileText,
  GitMerge,
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
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import RollbackCheckpointModal from '@/components/history/RollbackCheckpointModal'
import { aiModels, chatSuggestions, findCanvasTarget, forProject, projectChatGreetings } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { mergeChatSuggestions } from '@/lib/mergeChat'
import { LocalizedText } from '@/i18n/runtime'

const suggestionIcons = { MessageCircle, Sparkles, Pin }

// ─── Request target ────────────────────────────────────────────────────
// What an AI request is about: the selected element, the current page, or
// the open file. It follows the current selection (so the chip never
// disagrees with what's selected) unless one was picked explicitly for
// this selection; with no element selected there's no default — you pick.
// The target is captured on the message when sent, and the AI only applies
// a change that lands inside it.

// The same shape TargetChip/sendChatMessage expect for a canvas element,
// built straight from a layer id rather than from the live selection — so
// a suggestion chip tied to one specific element (see chatSuggestions'
// `targetLayerId`) can target it directly, regardless of what's currently
// selected on canvas.
function elementTarget(layerId) {
  const hit = layerId && findCanvasTarget(layerId)
  if (!hit) return null
  const name = hit.layer?.name ?? hit.frame?.name
  return { kind: 'element', key: `element:${layerId}`, layerId, pageId: hit.page.id, label: `${hit.page.name} → ${name}` }
}

function targetOptions(workspace) {
  const { selectedLayerId, activePageId, activeFileId, projectPages, getFileName } = workspace
  const options = []
  const hit = selectedLayerId && elementTarget(selectedLayerId)
  if (hit) options.push(hit)
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
  options.push(...workspace.referenceDocs.map(documentTarget))
  return options
}

function selectionKey({ selectedLayerId, activePageId, activeFileId }) {
  return `${selectedLayerId ?? ''}|${activePageId ?? ''}|${activeFileId ?? ''}`
}

const TARGET_KIND_LABEL = { element: 'Selected element', page: 'Current page', file: 'Open file', document: 'Docs document' }

function TargetChip({ target, options, onPick }) {
  const workspace = useWorkspace()
  const fileName = (target?.kind === 'file' || target?.kind === 'document')
    ? target.label
    : target?.fileId
      ? workspace.getFileName(target.fileId)
      : workspace.activeFileId
        ? workspace.getFileName(workspace.activeFileId)
        : null
  const Icon = target?.kind === 'document' ? FileText : getFileIconMeta(fileName ?? '').Icon
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
  pending: { label: 'Needs your approval', icon: CircleAlert, className: 'text-amber-400' },
  discarded: { label: 'Discarded', icon: CircleMinus, className: 'text-muted-foreground' },
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// What an AI request actually did: status, the changes (file · line ·
// what), counts, and links into the existing paths — the changed code and
// element ("View changes") and the Conflict Point now awaiting review
// ("Review changes"). A request that changed nothing says so, and has no
// checkpoint.
function ResultCard({ result, messageId }) {
  const { focusChange, setBottomPanel, openConflictReview, applyPendingAiEdit, discardPendingAiEdit } = useWorkspace()
  const status = RESULT_STATUS[result.status] ?? RESULT_STATUS.done
  const StatusIcon = status.icon
  const pending = result.status === 'pending'
  const changed = result.status === 'done' || result.status === 'partial' || pending
  const first = result.changes?.[0]

  return (
    <div className="mt-1.5 w-[92%] rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]', status.className)}>
          <StatusIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100">{changed ? result.title : status.label}</p>
          {result.target && <p className="truncate text-[10px] text-slate-500">{result.target.label}</p>}
        </div>
        {changed && <span className={cn('shrink-0 text-[10px] font-medium', status.className)}>{status.label}</span>}
      </div>
      {changed && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-amber-200">
              {pending ? 'Proposed · not applied' : 'Draft · not merged'}
            </span>
            <span className="text-[10px] text-slate-500">
              {plural(result.fileCount, 'file')} · {plural(result.elementCount, 'element')}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {result.changes.map((c, i) => (
              <li key={i} className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-4 text-slate-200">
                <span className="min-w-0 break-words">{c.summary}</span>
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
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
            {pending ? (
              <>
                <Button
                  type="button"
                  size="xs"
                  className="ds-intrinsic h-6 min-h-6 rounded-md bg-emerald-300 px-2 text-[10px] font-medium text-emerald-950 hover:bg-emerald-200"
                  onClick={() => applyPendingAiEdit(messageId)}
                >
                  Apply change
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="ds-intrinsic h-6 min-h-6 rounded-md border-transparent bg-transparent px-2 text-[10px]"
                  onClick={() => discardPendingAiEdit(messageId)}
                >
                  Discard
                </Button>
              </>
            ) : (
              <>
                {first && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="ds-intrinsic h-6 min-h-6 rounded-md border-transparent bg-transparent px-2 text-[10px]"
                    onClick={() => focusChange({ fileId: first.fileId, line: first.line, layerId: result.target?.layerId })}
                  >
                    View changes
                  </Button>
                )}
                {result.reviewItems.length > 0 && (
                  <Button
                    type="button"
                    size="xs"
                    className="ds-intrinsic h-6 min-h-6 rounded-md bg-emerald-300 px-2 text-[10px] font-medium text-emerald-950 hover:bg-emerald-200"
                    onClick={() => {
                      setBottomPanel({ tab: 'conflict', open: true })
                      openConflictReview(result.reviewItems[0].conflictId)
                    }}
                  >
                    Review changes
                  </Button>
                )}
              </>
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
      className={cn('ds-intrinsic inline-flex size-5 items-center justify-center rounded-md [&>svg]:size-3 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-200 disabled:pointer-events-none disabled:opacity-30', pressed && 'bg-emerald-400/10 text-emerald-300')}>
      {children}
    </button>
  )
}

// The "Ask Devsign" conversation itself — suggestions, the messages (each
// AI change with its inline checkpoint and "Rollback here"), the composer —
// shared by the floating chat widget and the AI Chat pane, so both are the
// same conversation (the workspace's chat state) with the same controls.
function ChatConversation() {
  const language = useLanguage()
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
    chatThreadItem,
  } = workspace
  const options = targetOptions(workspace)
  const key = selectionKey(workspace)
  const picked = (chatTargetOverride?.key?.startsWith('document:') || chatTargetOverride?.selection === key) ? options.find((o) => o.key === chatTargetOverride.key) : null
  const target = picked ?? options.find((o) => o.kind === 'element') ?? null
  // In Merge Studio the conversation is the open item's own (see
  // WorkspaceProvider's `chatThread`), with prompts about that item.
  const suggestions = chatThreadItem ? mergeChatSuggestions() : forProject(chatSuggestions, projectId)
  const attachablePool = workspaceFiles.map((f) => f.name)
  const [attachments, setAttachments] = useState([])
  const [codeBlockMode, setCodeBlockMode] = useState(false)
  const [model, setModel] = useState(aiModels[1] ?? aiModels[0])
  // Off by default: an AI change sits in chat as a proposal (Apply /
  // Discard) until approved, rather than landing on canvas/files straight
  // away. Turning this on restores the old immediate-apply behavior.
  const [autoMode, setAutoMode] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [feedback, setFeedback] = useState({})
  // The checkpoint whose inline "Rollback here" was clicked (confirming).
  const [rollbackId, setRollbackId] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping])

  function handleSend(text = input, overrideTarget) {
    if (!text.trim() || isAiTyping) return
    sendChatMessage(text, overrideTarget ?? target, { autoApply: autoMode })
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

      {chatThreadItem && (
        <p className="flex shrink-0 items-center gap-1.5 px-5 pt-2.5 text-[10.5px] text-slate-500">
          <GitMerge className="size-3 shrink-0 text-emerald-300/80" />
          <LocalizedText text="Merge" />
          <span className="text-slate-600">·</span>
          <span className="min-w-0 truncate text-slate-300"><LocalizedText text={chatThreadItem.title} /></span>
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div ref={listRef} className="scroll-fade-bottom flex-1 space-y-5 overflow-auto px-5 py-3" style={{ '--scroll-fade-size': '14px', '--scroll-fade-edge': 'rgb(0 0 0 / 30%)' }}>
        {chatMessages.map((message, index) => (
          <div key={message.id} className={cn('group/chat flex w-full flex-col', message.role === 'user' ? 'items-end gap-1.5' : 'items-start gap-0.5')}>
            <div
              className={cn(
                'max-w-[88%] rounded-2xl px-4 py-3 text-[13px]',
                message.role === 'user'
                  ? 'ds-chat-user-bubble whitespace-pre-wrap leading-6'
                  : 'bg-slate-800/80 text-slate-200'
              )}
            >
              {message.role === 'user' ? (
                message.text
              ) : (
                <ChatMarkdown
                  text={message.id === 'seed-1' ? projectChatGreetings[projectId] ?? message.text : message.text}
                  summary={message.summary}
                />
              )}
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
              <ActionButton label="Regenerate" disabled={isAiTyping || Boolean(message.historyId) || Boolean(message.pendingEdit) || !chatMessages.slice(0, index).some((m) => m.role === 'user')} onClick={() => { const previous = chatMessages.slice(0, index).reverse().find((m) => m.role === 'user'); if (previous) sendChatMessage(previous.text, previous.target, { includeUser: false, replaceMessageId: message.id, autoApply: autoMode }) }}><RotateCw className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs up" pressed={feedback[message.id] === 'up'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'up' ? null : 'up' }))}><ThumbsUp className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs down" pressed={feedback[message.id] === 'down'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'down' ? null : 'down' }))}><ThumbsDown className="size-3.5" /></ActionButton>
              <ActionButton label="Share" onClick={() => shareMessage(message)}><Share2 className="size-3.5" /></ActionButton>
            </div>}
            {message.result && <ResultCard result={message.result} messageId={message.id} />}
            {/* A drafted review note: into the conflict's Comments box —
                sending, and requesting the review, stay in the review. */}
            {message.commentDraft && (
              <button
                type="button"
                onClick={() => workspace.draftCommentFromChat(message.commentDraft)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-white transition-colors hover:bg-white/[0.1]"
              >
                <MessageCircle className="size-3.5 text-emerald-300" />
                <LocalizedText text="Use as comment" />
              </button>
            )}
            {message.historyId && <ChatCheckpoint historyId={message.historyId} onRollback={setRollbackId} />}
          </div>
        ))}
        {isAiTyping && <TypingBubble />}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 px-2 pt-3 pb-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestionIcons[suggestion.iconName]
          const fixedTarget = suggestion.targetLayerId ? elementTarget(suggestion.targetLayerId) : null
          return (
            <button
              key={suggestion.id}
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSend(suggestion.prompt, fixedTarget)}
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
                <button type="button" onClick={() => removeAttachment(file)} title="Remove attachment" aria-label="Remove attachment">
                  <X className="size-2.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-transparent bg-white/[0.035] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/15 ">
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
            placeholder={translateText('Ask Devsign to tweak the design or code...', language)}
            className="w-full resize-none border-none bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon-xs" onClick={handleAttach} title="Attach file" aria-label="Attach file">
                <Paperclip className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setCodeBlockMode((v) => !v)}
                className={cn(codeBlockMode && 'bg-emerald-400/10 text-emerald-300')}
                title="Code block"
                aria-label="Code block"
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
              <label
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                title={autoMode ? 'Auto-apply AI changes without asking first' : 'AI changes wait for your approval before they apply'}
              >
                Auto
                <Switch
                  checked={autoMode}
                  onCheckedChange={setAutoMode}
                  size="sm"
                  className="ds-intrinsic ai-chat-auto-switch"
                />
              </label>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleSend()}
                disabled={!input.trim() || !target}
                title={target ? 'Send' : 'Choose a target first'}
                style={{ borderRadius: '9999px', width: 32, height: 32, backgroundColor: '#5EEAB5', color: '#06281D' }}
                className="ai-chat-submit ds-chat-submit"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatConversation
