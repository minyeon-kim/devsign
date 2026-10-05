import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const { notifications, projectId, mergeDrawer, setMergeDrawer, exitMergeStudio, setBottomPanel, openConflictReview } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [requestDismissed, setRequestDismissed] = useState(false)
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  useEffect(() => { if (!onWorkspace) setRequestDismissed(false) }, [onWorkspace])
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
  if (!show) return null

  return (
    <aside ref={stackRef} aria-label="High priority notifications" aria-live="polite" style={anchor} className="pointer-events-none fixed z-[120] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {showRequest && (
        <section className={NOTICE_CARD}>
          <NoticeDismiss label="알림 닫기" onClick={() => setRequestDismissed(true)} />
          <div className="flex items-start gap-3 pr-5">
            <span className={cn(NOTICE_ICON, NOTICE_ICON_TONE.neutral)}><Bell className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className={NOTICE_TITLE}>검토 요청 · Jordan</p>
              <p className={cn(NOTICE_BODY, 'text-slate-300')}>“결제 버튼 높이와 색상 변경을 검토해 주세요.”</p>
              <p className={NOTICE_BODY}>충돌 목록에서 변경을 확인하고 히스토리의 근거를 바탕으로 합칠 내용을 정한 뒤, 다른 검토자에게 의견과 승인을 요청하세요.</p>
            </div>
          </div>
          <div className={NOTICE_ACTIONS}>
            <button type="button" onClick={() => setRequestDismissed(true)} className={NOTICE_ACTION_QUIET}>나중에</button>
            <button type="button" onClick={() => { setRequestDismissed(true); exitMergeStudio(); openConflictReview('cc-11'); setBottomPanel({ tab: 'conflict', open: true }) }} className={NOTICE_ACTION}>검토 내용 열기</button>
          </div>
        </section>
      )}
      {entry.prompt && <ConflictEntryPromptCard prompt={entry.prompt} onOpen={entry.open} onClose={entry.close} />}
      {banners.map(n => (
        <section key={n.id} className={NOTICE_CARD}>
          <NoticeDismiss label="알림 닫기" onClick={() => dismiss(n.id)} />
          <div className="flex items-start gap-3 pr-5">
            <span className={cn(NOTICE_ICON, NOTICE_ICON_TONE.urgent)}><Bell className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className={NOTICE_TITLE}>High · 즉시 검토가 필요합니다</p>
              <p className={cn(NOTICE_BODY, 'line-clamp-2 text-slate-300')}>{n.target.label}</p>
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
