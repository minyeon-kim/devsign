import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { Notification, NotificationRow } from '@/components/layout/Notification'
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
// (On the notification's light surface: its own, darker accents.)
const SEVERITY_DOT = { high: 'var(--notification-error)', medium: 'var(--notification-warning)', low: 'var(--notification-text-secondary)' }
const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
const MAX_ROWS = 3

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
  const { conflicts, projectId, mergeDrawer, openConflictFromNotification } = useWorkspace()
  const { pathname } = useLocation()
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  const viewerId = currentUserFor(projectId).id
  const storageKey = `devsign:entry-prompt:v1:${projectId}:${viewerId}`
  const [prompt, setPrompt] = useState(null)
  const [due, setDue] = useState(false)

  // The delay starts on entering the Workspace; leaving it drops the prompt.
  useEffect(() => {
    if (!onWorkspace || projectId === 'mobile-nav-revamp') {
      setDue(false)
      setPrompt(null)
      return
    }
    const timer = window.setTimeout(() => setDue(true), DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [onWorkspace, projectId])

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
    openConflictFromNotification(conflictId)
  }

  // The Inbox open over the same spot already lists what's waiting.
  const visible = prompt && mergeDrawer !== 'inbox' ? prompt : null
  const conflictIds = useMemo(() => new Set(visible?.items.map((c) => c.id) ?? []), [visible])
  return { prompt: visible, conflictIds, close, open }
}

const PROMPT_ACTION = { high: 'Review the first one', review: 'Start reviewing', intro: 'Open the first one' }

export function ConflictEntryPromptCard({ prompt, onOpen, onClose }) {
  const rows = prompt.items.slice(0, MAX_ROWS)
  const more = prompt.items.length - rows.length

  // (Every card under the Inbox bell — this prompt, review requests, the
  // high-priority banners — is the one Notification, differing by type.)
  return (
    <Notification
      as="div"
      role="dialog"
      aria-label="Conflict Points"
      type={prompt.kind === 'high' ? 'error' : 'warning'}
      icon={TriangleAlert}
      title={prompt.title}
      onDismiss={onClose}
      actions={[
        { label: 'Later', quiet: true, onClick: onClose },
        { label: PROMPT_ACTION[prompt.kind] ?? PROMPT_ACTION.intro, onClick: () => onOpen(rows[0].id) },
      ]}
    >
      <ul className="mt-3 space-y-0.5">
        {rows.map((conflict) => (
          <li key={conflict.id}>
            <NotificationRow onClick={() => onOpen(conflict.id)} className="-mx-1.5 h-7 w-[calc(100%+12px)] items-center gap-2 px-1.5 text-xs">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_DOT[conflict.severity] ?? SEVERITY_DOT.low }} />
              <span className="min-w-0 flex-1 truncate font-medium">{conflict.title}</span>
              <span className="ds-notification-meta shrink-0">{SEVERITY_LABEL[conflict.severity] ?? conflict.severity}</span>
            </NotificationRow>
          </li>
        ))}
        {more > 0 && <li className="ds-notification-meta px-1.5 pt-0.5">{`+ ${more} more`}</li>}
      </ul>
    </Notification>
  )
}
