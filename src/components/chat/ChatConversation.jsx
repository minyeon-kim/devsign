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
  Square,
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
import { approvalState, approvalSummary, decidedLine } from '@/lib/approvalCard'

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
const RESULT_ACTION = 'ds-intrinsic inline-flex h-7 min-h-7 items-center justify-center rounded-md border border-white/15 bg-white/[0.05] px-3 text-[11px] font-medium leading-none text-slate-100 transition-colors hover:border-emerald-300/50 hover:bg-emerald-400/10 focus-visible:outline-2 focus-visible:outline-emerald-300'

function ResultCard({ result, messageId }) {
  const { focusChange, setBottomPanel, openConflictReview, activeView } = useWorkspace()
  const status = RESULT_STATUS[result.status] ?? RESULT_STATUS.done
  const StatusIcon = status.icon
  const pending = result.status === 'pending'
  const changed = result.status === 'done' || result.status === 'partial' || pending
  const first = result.changes?.[0]

  return (
    <div className="mt-1.5 w-[92%] rounded-xl border border-white/10 bg-white/[0.025] p-4 text-xs">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]', status.className)}>
          <StatusIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs leading-5 font-semibold text-slate-100">{changed ? result.title : status.label}</p>
            {changed && <span className={cn('text-[10px] font-medium', status.className)}>{status.label}</span>}
          </div>
          {result.target && <p className="mt-1 truncate text-[11px] leading-4 text-slate-400">{result.target.label}</p>}
        </div>
      </div>
      {changed && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-medium text-amber-200">
              {pending ? 'Proposed · not applied' : 'Draft · not merged'}
            </span>
            <span className="text-[10px] text-slate-500">
              {plural(result.fileCount, 'file')} · {plural(result.elementCount, 'element')}
            </span>
          </div>
          <ul className="my-4 space-y-3">
            {result.changes.map((c, i) => (
              <li key={i} className="flex min-w-0 flex-col gap-1.5 text-xs leading-5 text-slate-200">
                <span className="min-w-0 break-words">{c.summary}</span>
                <span className="shrink-0 truncate font-mono text-[11px] text-slate-400">
                  {c.fileName}{c.line ? `:${c.line}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {result.note && <p className="mt-1 text-[11px] text-amber-400/90">{result.note}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-3">
            {result.reviewItems.length > 0 && (
              <p className="mb-1 w-full text-[11px] leading-4 text-slate-300">
                {plural(result.reviewItems.length, 'change')} ready for review
              </p>
            )}
            {/* (A request still waiting is the ApprovalCard's, above the message — not this card's.) */}
            {!pending && (
              <>
                {first && (
                  <button
                    type="button"
                    className={RESULT_ACTION}
                    onClick={() => focusChange({ fileId: first.fileId, line: first.line, layerId: result.target?.layerId })}
                  >
                    View changes
                  </button>
                )}
                {result.reviewItems.length > 0 && (
                  <button
                    type="button"
                    className={RESULT_ACTION}
                    onClick={() => {
                      // (The one way a change opens: full screen with the left list — in Merge Studio, its bottom panel.)
                      if (activeView === 'mergeStudio') { setBottomPanel({ tab: 'conflict', open: true }); openConflictReview(result.reviewItems[0].conflictId, { view: 'panel' }) }
                      else openConflictReview(result.reviewItems[0].conflictId)
                    }}
                  >
                    Review changes
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// What an approval request touches, in full: the element it's about, each
// change with its file and line, and any note — the card's "Show details".
function ApprovalDetails({ result }) {
  return (
    <div data-approval-details className="mt-3 border-t border-white/[0.08] pt-3">
      {result.target && <p className="truncate text-[11px] leading-4 text-slate-400">{result.target.label}</p>}
      <p className="mt-1 text-[10px] text-slate-500">{plural(result.fileCount ?? 0, 'file')} · {plural(result.elementCount ?? 0, 'element')}</p>
      <ul className="mt-2 space-y-2.5">
        {(result.changes ?? []).map((c, i) => (
          <li key={i} className="flex min-w-0 flex-col gap-1 text-xs leading-5 text-slate-200">
            <span className="min-w-0 break-words">{c.summary}</span>
            <span translate="no" className="truncate font-mono text-[11px] text-slate-400">{c.fileName}{c.line ? `:${c.line}` : ''}</span>
          </li>
        ))}
      </ul>
      {result.note && <p className="mt-2 text-[11px] text-amber-400/90">{result.note}</p>}
    </div>
  )
}

// An AI request waiting on the person — above what the AI wrote about it, so
// it's the first thing read. What it says comes from the request itself
// (lib/approvalCard: the files it will change, not the AI's prose): a title,
// the targets, a warning only when it can't be taken back, Approve / Decline,
// and the rest behind "Show details". Decided, it folds to one line that
// opens to the same details (an approved one: its result, with its links).
// Nothing here answers a key from elsewhere — its buttons act when they're
// pressed or have the focus — and a press is taken once.
const APPROVAL_MARK = {
  approved: { icon: Check, className: 'text-emerald-300' },
  declined: { icon: X, className: 'text-slate-400' },
  expired: { icon: CircleMinus, className: 'text-slate-500' },
}
function ApprovalCard({ message }) {
  const { applyPendingAiEdit, discardPendingAiEdit } = useWorkspace()
  const state = approvalState(message)
  const summary = approvalSummary(message.result)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [failed, setFailed] = useState(null)
  const working = useRef(false)
  // Decided with the focus on one of its buttons: the focus goes to the line it folds to.
  const cardRef = useRef(null)
  const refocus = useRef(false)
  useEffect(() => {
    if (state === 'pending' || !refocus.current) return
    refocus.current = false
    cardRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [state])

  function act(which) {
    if (working.current || state !== 'pending') return
    working.current = true
    refocus.current = Boolean(cardRef.current?.contains(document.activeElement))
    setBusy(which)
    setFailed(null)
    setOpen(false)
    // (A frame for the button to say it's working; then the same write as before.)
    requestAnimationFrame(() => {
      try {
        if (which === 'approve') applyPendingAiEdit(message.id)
        else discardPendingAiEdit(message.id)
      } catch {
        setFailed(which)
      } finally {
        working.current = false
        setBusy(null)
      }
    })
  }

  const targets = (
    <p data-approval-targets className="mt-0.5 truncate text-[11px] leading-4 text-slate-400">
      <span translate="no" className="font-mono">{summary.targets.join(', ')}</span>
      {summary.more > 0 && <span className="ml-1">{`and ${summary.more} more`}</span>}
    </p>
  )

  if (state !== 'pending') {
    const mark = APPROVAL_MARK[state] ?? APPROVAL_MARK.expired
    const line = decidedLine(state, summary)
    return (
      <div ref={cardRef} data-approval-card={state} className="mb-1 w-[92%] text-xs">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          title={open ? 'Hide details' : 'Show details'}
          className="ds-intrinsic inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <mark.icon className={cn('size-3.5 shrink-0', mark.className)} />
          <span className="shrink-0 font-medium text-slate-200">{line.label}</span>
          <span aria-hidden className="text-slate-600">·</span>
          <span className="min-w-0 truncate">{line.title}</span>
          <ChevronDown className={cn('size-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
        {open && (state === 'approved'
          ? <ResultCard result={message.result} messageId={message.id} />
          : (
            <div className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-4 pb-4">
              {state === 'expired' && <p className="pt-3 text-[11px] text-slate-400">This request is no longer available.</p>}
              <ApprovalDetails result={message.result} />
            </div>
          ))}
      </div>
    )
  }

  return (
    <div ref={cardRef} data-approval-card="pending" role="group" aria-label="Approval request" className="mb-1.5 w-[92%] rounded-xl border border-white/15 bg-white/[0.04] p-3.5 text-xs">
      <p data-approval-title title={summary.fullTitle} className="truncate text-[13px] leading-5 font-semibold text-slate-100">{summary.title}</p>
      {targets}
      {summary.risk && (
        <p data-approval-risk className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
          <CircleAlert className="size-3.5 shrink-0" />
          {summary.risk}
        </p>
      )}
      {failed && (
        <p role="alert" data-approval-error className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-rose-300">
          Couldn’t apply. Try again.
          <button type="button" onClick={() => act(failed)} className="ds-intrinsic rounded-md px-1.5 py-0.5 font-medium text-slate-100 underline-offset-2 hover:underline">Retry</button>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" data-approval-approve disabled={Boolean(busy)} aria-busy={busy === 'approve'} onClick={() => act('approve')}
          className="ds-intrinsic inline-flex h-7 min-h-7 items-center justify-center rounded-md bg-emerald-400 px-3 text-[11px] font-semibold leading-none text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-60">
          {busy === 'approve' ? 'Applying…' : 'Approve'}
        </button>
        <button type="button" data-approval-decline disabled={Boolean(busy)} aria-busy={busy === 'decline'} onClick={() => act('decline')} className={cn(RESULT_ACTION, 'disabled:pointer-events-none disabled:opacity-60')}>
          Decline
        </button>
        <button type="button" data-approval-more aria-expanded={open} onClick={() => setOpen((value) => !value)}
          className="ds-intrinsic ml-auto inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
          {open ? 'Hide details' : 'Show details'}
          <ChevronDown className={cn('size-3 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </div>
      {open && <ApprovalDetails result={message.result} />}
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[20px] bg-muted px-3.5 py-3">
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
    stopChatGeneration,
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
  const [copiedId, setCopiedId] = useState(null)
  const [feedback, setFeedback] = useState({})
  // The checkpoint whose inline "Rollback here" was clicked (confirming).
  const [rollbackId, setRollbackId] = useState(null)
  const listRef = useRef(null)
  // The suggestions overlay the end of the list; the list keeps that much
  // room under its last message so nothing ends up hidden behind them.
  const suggestionsRef = useRef(null)
  const [suggestionsHeight, setSuggestionsHeight] = useState(72)
  useEffect(() => {
    const el = suggestionsRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSuggestionsHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A new message (or the AI starting to write) brings the end into view —
  // unless what arrived is waiting for approval: then its card is what's
  // brought up, since it sits above the text. A message changing in place (a
  // request decided) moves nothing: what was being read stays where it is.
  const seen = useRef({ count: chatMessages.length, typing: isAiTyping })
  useEffect(() => {
    const list = listRef.current
    const before = seen.current
    seen.current = { count: chatMessages.length, typing: isAiTyping }
    if (!list || (before.count === chatMessages.length && before.typing === isAiTyping)) return
    const last = chatMessages[chatMessages.length - 1]
    const card = chatMessages.length > before.count && approvalState(last) === 'pending' ? [...list.querySelectorAll('[data-approval-card="pending"]')].pop() ?? null : null
    if (card) list.scrollTo({ top: Math.max(0, list.scrollTop + card.getBoundingClientRect().top - list.getBoundingClientRect().top - 12), behavior: 'smooth' })
    else list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping])

  // A request waiting out of sight: a chip over the end of the list goes to
  // it. (Checked as the list scrolls, as messages change, as it's resized.)
  const awaiting = chatMessages.filter((message) => approvalState(message) === 'pending').length
  const [awaitingHidden, setAwaitingHidden] = useState(false)
  const pendingCard = () => listRef.current?.querySelector('[data-approval-card="pending"]') ?? null
  const showPending = () => { const list = listRef.current; const card = pendingCard(); if (list && card) list.scrollTo({ top: Math.max(0, list.scrollTop + card.getBoundingClientRect().top - list.getBoundingClientRect().top - 12), behavior: 'smooth' }) }
  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const check = () => {
      const card = pendingCard()
      if (!card) { setAwaitingHidden(false); return }
      const view = list.getBoundingClientRect()
      // (Its buttons are what has to be in view: a card showing only its top edge is still out of reach.)
      const box = (card.querySelector('[data-approval-approve]') ?? card).getBoundingClientRect()
      setAwaitingHidden(view.width > 0 && (box.bottom < view.top + 8 || box.top > view.bottom - 8))
    }
    check()
    list.addEventListener('scroll', check, { passive: true })
    const observer = new ResizeObserver(check)
    observer.observe(list)
    return () => { list.removeEventListener('scroll', check); observer.disconnect() }
  }, [chatMessages])
  // AI Chat unfolded with a request waiting: straight to it.
  const chatOpen = workspace.aiChat?.open
  useEffect(() => {
    if (chatOpen && awaiting) requestAnimationFrame(showPending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen])

  function handleSend(text = input, overrideTarget) {
    if (!text.trim() || isAiTyping) return
    sendChatMessage(text, overrideTarget ?? target, { autoApply: false })
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
        {/* (Ends where the suggestions begin: no message ever runs under them, so nothing has to fade.) */}
        <div ref={listRef} className="flex-1 space-y-5 overflow-auto px-5 pt-3 pb-3" style={{ marginBottom: suggestionsHeight }}>
        {chatMessages.map((message, index) => (
          <div key={message.id} className={cn('group/chat flex w-full flex-col', message.role === 'user' ? 'items-end gap-1.5' : 'items-start gap-0.5')}>
            {/* A request that asks (or asked) for approval comes first, above what the AI wrote about it. */}
            {approvalState(message) && <ApprovalCard message={message} />}
            <div
              className={cn(
                // (20px round on every corner — no tail.)
                'max-w-[88%] rounded-[20px] px-4 py-3 text-[13px]',
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
              <ActionButton label="Regenerate" disabled={isAiTyping || Boolean(message.historyId) || Boolean(message.pendingEdit) || !chatMessages.slice(0, index).some((m) => m.role === 'user')} onClick={() => { const previous = chatMessages.slice(0, index).reverse().find((m) => m.role === 'user'); if (previous) sendChatMessage(previous.text, previous.target, { includeUser: false, replaceMessageId: message.id, autoApply: false }) }}><RotateCw className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs up" pressed={feedback[message.id] === 'up'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'up' ? null : 'up' }))}><ThumbsUp className="size-3.5" /></ActionButton>
              <ActionButton label="Thumbs down" pressed={feedback[message.id] === 'down'} onClick={() => setFeedback((f) => ({ ...f, [message.id]: f[message.id] === 'down' ? null : 'down' }))}><ThumbsDown className="size-3.5" /></ActionButton>
              <ActionButton label="Share" onClick={() => shareMessage(message)}><Share2 className="size-3.5" /></ActionButton>
            </div>}
            {message.result && !approvalState(message) && <ResultCard result={message.result} messageId={message.id} />}
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
        {/* (Said once, politely, when a request arrives; the focus stays where it was.) */}
        <span role="status" aria-live="polite" className="sr-only">{awaiting > 0 ? 'Approval requested' : ''}</span>
        {awaitingHidden && (
          <button type="button" data-approval-chip onClick={showPending} style={{ bottom: suggestionsHeight + 4 }}
            className="ds-intrinsic absolute left-1/2 z-10 inline-flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-300/30 bg-[#222224] px-3 text-[11px] font-medium text-amber-100 shadow-lg transition-colors hover:border-amber-300/60 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <CircleAlert className="size-3.5 text-amber-300" />
            Approval requested
          </button>
        )}
          {/* The suggestions, under the conversation and over the input — no gradient behind them. */}
          <div ref={suggestionsRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-2 px-2 pt-2 pb-2 [&>button]:pointer-events-auto">
          {suggestions.map((suggestion) => {
            const Icon = suggestionIcons[suggestion.iconName]
            const fixedTarget = suggestion.targetLayerId ? elementTarget(suggestion.targetLayerId) : null
            return (
              <button
                key={suggestion.id}
                type="button"
                disabled={isAiTyping}
                onClick={() => handleSend(suggestion.prompt, fixedTarget)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#222224] px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-emerald-400/30 hover:text-white disabled:opacity-50"
              >
                {Icon && <Icon className="size-3 text-emerald-300" />}
                {suggestion.label}
              </button>
            )
          })}
        </div>
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

        {/* (iOS: one well-rounded field — 24px corners, its contents kept clear of them.) */}
        <div className="rounded-[24px] border border-transparent bg-white/[0.035] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/15 ">
          {/* In Merge Studio the conversation is about the open item, so a
              file chip only shows for an element selected on its canvas —
              never a stray code file the item doesn't touch. */}
          {(!chatThreadItem || target) && (
            <div className="flex min-w-0 items-center px-3.5 pt-2.5">
              <TargetChip
                target={target}
                options={options}
                onPick={(option) => setChatTargetOverride({ key: option.key, selection: key })}
              />
            </div>
          )}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={translateText('Ask Devsign to tweak the design or code...', language)}
            className="w-full resize-none border-none bg-transparent px-4 py-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5">
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
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => isAiTyping ? stopChatGeneration() : handleSend()}
                disabled={!isAiTyping && (!input.trim() || !target)}
                aria-label={isAiTyping ? 'Stop generating' : 'Send'}
                title={isAiTyping ? 'Stop generating' : target ? 'Send' : 'Choose a target first'}
                className="ai-chat-submit"
              >
                {isAiTyping ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatConversation
