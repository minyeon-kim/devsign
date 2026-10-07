import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { comments as seedComments } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { Bell } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'
import {
  ConflictEntryPromptCard,
  NOTICE_ACTION,
  NOTICE_ACTION_QUIET,
  NOTICE_ACTIONS,
  NOTICE_BODY,
  NOTICE_CARD,
  NOTICE_ICON,
  NOTICE_ICON_TONE,
  NOTICE_TITLE,
  NoticeDismiss,
  useConflictEntryPrompt,
} from '@/components/layout/ConflictEntryPrompt'

// Where the banners stack when the page has no Inbox bell (Merge Studio,
// Docs, …): the top-right corner, under the header row.
const FALLBACK_ANCHOR = { top: 56, right: 16 }

// The on-screen Inbox bell (InboxButton tags itself), if any.
function findBell() {
  return document.querySelector('[data-inbox-button]')
}

// Banners hang just under the bell — they're Inbox items, so they appear
// where the Inbox opens from — right edges aligned. The bell sits in a
// different place per page (Workspace's top-right toolbar, Project home's
// centered header), so it's measured, and re-measured on resize/scroll.
function useBellAnchor(active) {
  const [anchor, setAnchor] = useState(FALLBACK_ANCHOR)
  useLayoutEffect(() => {
    if (!active) return
    function measure() {
      const rect = findBell()?.getBoundingClientRect()
      setAnchor(rect ? { top: rect.bottom + 8, right: window.innerWidth - rect.right } : FALLBACK_ANCHOR)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active])
  return anchor
}

// Project-wide review banners survive navigation between project pages.
// Dismissing a banner leaves its review unread in the inbox.
export default function HighReviewNotifications() {
  const { comments, notifications, projectId, mergeDrawer, setMergeDrawer, exitMergeStudio, setBottomPanel, openConflictReview, restartConflict } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [requestDismissed, setRequestDismissed] = useState(false)
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  const showRequest = onWorkspace && projectId === 'checkout-redesign' && !requestDismissed
  const seen = useRef(new Set())
  const [visibleIds, setVisibleIds] = useState([])

  useEffect(() => {
    const fresh = notifications.filter(n => n.notificationType === 'review_request' && n.severity === 'high' && n.unread && !seen.current.has(n.id))
    if (!fresh.length) return
    fresh.forEach(n => seen.current.add(n.id))
    setVisibleIds(ids => [...ids, ...fresh.map(n => n.id)].slice(-3))
  }, [notifications])

  useEffect(() => {
    const timers = visibleIds.map(id => window.setTimeout(() => {
      setVisibleIds(ids => ids.filter(entry => entry !== id))
    }, 10000))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [visibleIds])

  function dismiss(id) {
    setVisibleIds(ids => ids.filter(entry => entry !== id))
  }
  // The entry prompt (see ConflictEntryPrompt) sits on top of the stack;
  // a review banner for a conflict it already lists would say it twice.
  const entry = useConflictEntryPrompt()
  const banners = visibleIds.map(id => notifications.find(n => n.id === id && n.unread)).filter(n => n && !entry.conflictIds.has(n.target?.conflictId))
  // With the Inbox open the same items are already on screen, in the spot
  // the banners would cover.
  const show = (showRequest || banners.length > 0 || !!entry.prompt) && mergeDrawer !== 'inbox'
  const anchor = useBellAnchor(show)
  // Toasts land in the same corner. They start under this stack instead of
  // on top of it: its bottom edge is published as `--ds-toast-top` (read by
  // the toaster's rule in index.css) for as long as it's on screen.
  const stackRef = useRef(null)
  useEffect(() => {
    const el = stackRef.current
    const root = document.documentElement
    if (!show || !el) return
    const publish = () => root.style.setProperty('--ds-toast-top', `${Math.round(el.getBoundingClientRect().bottom + 8)}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--ds-toast-top')
    }
  }, [show, anchor.top, banners.length, showRequest, entry.prompt])
  function dismissEntry() {
    // Suppressed duplicates must not surface after their summary is closed.
    setVisibleIds(ids => ids.filter(id => !entry.conflictIds.has(notifications.find(n => n.id === id)?.target?.conflictId)))
    entry.close()
  }

  function dismissAll() {
    setRequestDismissed(true)
    setVisibleIds([])
    entry.close()
    toast.dismiss()
  }
  if (!show) return null

  return (
    <aside ref={stackRef} aria-label="High priority notifications" aria-live="polite" style={{ ...anchor, maxHeight: `calc(100dvh - ${anchor.top + 16}px)` }} className="pointer-events-none fixed z-[1100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto overscroll-contain">
      <div className="pointer-events-auto sticky top-0 z-20 flex shrink-0 justify-end">
        <button type="button" onClick={dismissAll} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-md hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600">알림 모두 닫기</button>
      </div>
      {showRequest && (
        <section className={NOTICE_CARD}>
          <NoticeDismiss label="알림 닫기" onClick={() => setRequestDismissed(true)} />
          <div className="flex items-start gap-3 pr-8">
            <span className={cn(NOTICE_ICON, NOTICE_ICON_TONE.neutral)}><Bell className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className={NOTICE_TITLE}>검토 요청 · Jordan</p>
              <p className={NOTICE_BODY}><LocalizedText text={(comments.find((comment) => comment.id === 'comment-cc11') ?? seedComments.find((comment) => comment.id === 'comment-cc11'))?.text ?? ''} /></p>
            </div>
          </div>
          <div className={NOTICE_ACTIONS}>
            <button type="button" onClick={() => setRequestDismissed(true)} className={NOTICE_ACTION_QUIET}>나중에</button>
            {/* The walkthrough's way in: its conflict starts from before
                the review every time (opening it from the list shows it as
                it stands). */}
            <button type="button" data-scenario-open onClick={() => { setRequestDismissed(true); exitMergeStudio(); restartConflict('cc-11'); openConflictReview('cc-11'); setBottomPanel({ tab: 'conflict', open: true }) }} className={NOTICE_ACTION}>요청 검토하기</button>
          </div>
        </section>
      )}
      {entry.prompt && <ConflictEntryPromptCard prompt={entry.prompt} onOpen={entry.open} onClose={dismissEntry} />}
      {banners.map(n => (
        <section key={n.id} className={NOTICE_CARD}>
          <NoticeDismiss label="알림 닫기" onClick={() => dismiss(n.id)} />
          <div className="flex items-start gap-3 pr-8">
            <span className={cn(NOTICE_ICON, NOTICE_ICON_TONE.urgent)}><Bell className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className={NOTICE_TITLE}>위험도가 높아요. 바로 검토해 주세요.</p>
              <p className={cn(NOTICE_BODY, 'line-clamp-2')}>{n.target.label}</p>
            </div>
          </div>
          <div className={NOTICE_ACTIONS}>
            <button type="button" onClick={() => dismiss(n.id)} className={NOTICE_ACTION_QUIET}>나중에</button>
            <button type="button" onClick={() => {
              dismiss(n.id)
              setMergeDrawer('inbox')
              // Open it right here when this page has a bell; otherwise go to
              // the Workspace, where the Inbox lives.
              if (!findBell()) navigate(`/projects/${projectId}/workspace`)
            }} className={NOTICE_ACTION}>읽지 않은 알림 보기</button>
          </div>
        </section>
      ))}
    </aside>
  )
}
