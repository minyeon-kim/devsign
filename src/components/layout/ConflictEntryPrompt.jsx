import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { currentUserFor } from '@/data/mockData'
import { needsReviewFrom, isQueuedConflict } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

// A nudge under the Inbox bell a moment after entering a project's
// Workspace (or Merge Studio, which lives on the same route), pointing at
// the Conflict Points that need attention and opening them in one click.
// Tiered so it doesn't nag: new High-risk conflicts show it (once per set —
// a dismissed High conflict doesn't bring it back, a new one does), then
// reviews waiting on you (once a day), then a one-time intro for anyone who
// hasn't seen it. Medium/Low alone only light the bell.

const DELAY_MS = 1500
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }
const SEVERITY_DOT = { high: 'bg-rose-400', medium: 'bg-amber-400', low: 'bg-slate-400' }
const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
const MAX_ROWS = 3

// Every card that drops under the Inbox bell — this prompt, review requests
// and high-priority review banners (see HighReviewNotifications) — is built
// from these, so they read as one kind of notification: the same surface,
// icon chip, title / body type, dismiss button and right-aligned actions.
export const NOTICE_CARD = 'pointer-events-auto relative overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#252525]/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none'
export const NOTICE_ICON = 'flex size-8 shrink-0 items-center justify-center rounded-xl'
export const NOTICE_ICON_TONE = { neutral: 'bg-white/[0.07] text-emerald-300', urgent: 'bg-rose-400/15 text-rose-300' }
export const NOTICE_TITLE = 'text-[13px] font-medium text-white'
export const NOTICE_BODY = 'mt-0.5 text-xs leading-5 text-slate-400'
export const NOTICE_ACTIONS = 'mt-3 flex items-center justify-end gap-1'
export const NOTICE_ACTION = 'h-7 rounded-full bg-emerald-400/15 px-3 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25'
export const NOTICE_ACTION_QUIET = 'h-7 rounded-full px-3 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white'

export function NoticeDismiss({ label = '알림 닫기', onClick }) {
  return (
    <button
      type="button"
      data-notice-dismiss
      aria-label={label}
      title={label}
      onClick={onClick}
      className="ds-intrinsic pointer-events-auto absolute top-2 right-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-slate-200 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
    >
      <X className="pointer-events-none size-4" />
    </button>
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function readSeen(key) {
  try {
    return { seenHigh: [], reviewDay: '', intro: false, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
  } catch {
    return { seenHigh: [], reviewDay: '', intro: false }
  }
}

function writeSeen(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked — the prompt just shows again next time.
  }
}

// What the prompt should say right now, or null. Decided once, when it
// appears, so live conflict changes don't reshuffle an open prompt.
function decide(conflicts, viewerId, seen) {
  const open = conflicts
    .filter((c) => isQueuedConflict(c) && c.reviewStage !== 'resolved')
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
  if (!open.length) return null
  const high = open.filter((c) => c.severity === 'high')
  if (high.some((c) => !seen.seenHigh.includes(c.id))) {
    return { kind: 'high', title: `${plural(high.length, 'high-risk conflict')} need${high.length === 1 ? 's' : ''} a look`, items: high }
  }
  const mine = open.filter((c) => needsReviewFrom(c, viewerId))
  if (mine.length && seen.reviewDay !== today()) {
    return { kind: 'review', title: `${plural(mine.length, 'change')} waiting on your review`, items: mine }
  }
  if (!seen.intro) {
    return { kind: 'intro', title: `${open.length} open Conflict Point${open.length === 1 ? '' : 's'}`, items: open }
  }
  return null
}

export function useConflictEntryPrompt() {
  const { conflicts, projectId, mergeDrawer, setBottomPanel, openConflictReview } = useWorkspace()
  const { pathname } = useLocation()
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  const viewerId = currentUserFor(projectId).id
  const storageKey = `devsign:entry-prompt:v1:${projectId}:${viewerId}`
  const [prompt, setPrompt] = useState(null)
  const [due, setDue] = useState(false)

  // The delay starts on entering the Workspace; leaving it drops the prompt.
  useEffect(() => {
    if (!onWorkspace) {
      setDue(false)
      setPrompt(null)
      return
    }
    const timer = window.setTimeout(() => setDue(true), DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [onWorkspace])

  useEffect(() => {
    if (!due) return
    setDue(false)
    setPrompt(decide(conflicts, viewerId, readSeen(storageKey)))
  }, [due, conflicts, viewerId, storageKey])

  function close() {
    if (!prompt) return
    const seen = readSeen(storageKey)
    const highIds = conflicts.filter((c) => c.severity === 'high' && c.reviewStage !== 'resolved').map((c) => c.id)
    writeSeen(storageKey, {
      seenHigh: [...new Set([...seen.seenHigh, ...highIds])],
      reviewDay: prompt.kind === 'review' || prompt.kind === 'high' ? today() : seen.reviewDay,
      intro: true,
    })
    setPrompt(null)
  }

  function open(conflictId) {
    close()
    setBottomPanel({ tab: 'conflict', open: true })
    openConflictReview(conflictId)
  }

  // The Inbox open over the same spot already lists what's waiting.
  const visible = prompt && mergeDrawer !== 'inbox' ? prompt : null
  const conflictIds = useMemo(() => new Set(visible?.items.map((c) => c.id) ?? []), [visible])
  return { prompt: visible, conflictIds, close, open }
}

export function ConflictEntryPromptCard({ prompt, onOpen, onClose }) {
  const rows = prompt.items.slice(0, MAX_ROWS)
  const more = prompt.items.length - rows.length

  return (
    <div role="dialog" aria-label="Conflict Points" className={NOTICE_CARD}>
      <NoticeDismiss onClick={onClose} />

      <div className="flex items-start gap-3 pr-8">
        <span className={cn(NOTICE_ICON, NOTICE_ICON_TONE[prompt.kind === 'high' ? 'urgent' : 'neutral'])}>
          <TriangleAlert className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={NOTICE_TITLE}>{prompt.title}</p>
          <p className={NOTICE_BODY}>Conflict Points are where the design and the code differ — review each one, then merge.</p>
        </div>
      </div>

      <ul className="mt-3 space-y-0.5">
        {rows.map((conflict) => (
          <li key={conflict.id}>
            <button
              type="button"
              onClick={() => onOpen(conflict.id)}
              className="-mx-1.5 flex h-7 w-[calc(100%+12px)] min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <span className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_DOT[conflict.severity] ?? SEVERITY_DOT.low)} />
              <span className="min-w-0 flex-1 truncate">{conflict.title}</span>
              <span className="shrink-0 text-[10.5px] text-slate-500">{SEVERITY_LABEL[conflict.severity] ?? conflict.severity}</span>
            </button>
          </li>
        ))}
        {more > 0 && <li className="px-1.5 pt-0.5 text-[11px] text-slate-500">{`+ ${more} more`}</li>}
      </ul>

      <div className={NOTICE_ACTIONS}>
        <button type="button" onClick={onClose} className={NOTICE_ACTION_QUIET}>
          Later
        </button>
        <button type="button" onClick={() => onOpen(rows[0].id)} className={NOTICE_ACTION}>
          Review Conflict Points
        </button>
      </div>
    </div>
  )
}
