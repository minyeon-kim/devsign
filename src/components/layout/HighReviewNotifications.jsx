import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { comments as seedComments } from '@/data/mockData'
import { Bell } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ConflictEntryPromptCard, useConflictEntryPrompt } from '@/components/layout/ConflictEntryPrompt'
import { Notification } from '@/components/layout/Notification'

// The on-screen Inbox bell (InboxButton tags itself), if any.
function findBell() {
  return document.querySelector('[data-inbox-button]')
}

// Walkthrough review requests that appear a few seconds after entering a
// project's Workspace. `restart` puts the conflict back before its review.
const NAV_REQUEST_DELAY_MS = 4000
const NAV_REQUEST_BODY = 'Nav Icon / Size · 아이콘을 24px로 키운 디자인과 코드(20px)가 달라요. 확인 부탁드려요.'

// Project-wide review banners survive navigation between project pages.
// Dismissing a banner leaves its review unread in the inbox.
export default function HighReviewNotifications() {
  const { comments, conflicts, notifications, projectId, mergeDrawer, setMergeDrawer, exitMergeStudio, openConflictFromNotification, restartConflict } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [requestDismissed, setRequestDismissed] = useState(false)
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  const [navDue, setNavDue] = useState(false)
  const isNav = projectId === 'mobile-nav-revamp'
  useEffect(() => {
    if (!isNav || !onWorkspace) { setNavDue(false); return }
    const timer = window.setTimeout(() => setNavDue(true), NAV_REQUEST_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isNav, onWorkspace])
  const navResolved = conflicts.find((c) => c.id === 'cc-4')?.reviewStage === 'resolved'
  const showRequest = onWorkspace && !requestDismissed && (projectId === 'checkout-redesign' || (isNav && navDue && !navResolved))
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
  // Toasts land in the same corner. They stack above this stack instead of
  // on top of it: its occupied height is published as `--ds-toast-bottom` (read by
  // the toaster's rule in index.css) for as long as it's on screen.
  const stackRef = useRef(null)
  useEffect(() => {
    const el = stackRef.current
    const root = document.documentElement
    if (!show || !el) return
    const publish = () => root.style.setProperty('--ds-toast-bottom', `${Math.round(window.innerHeight - el.getBoundingClientRect().top + 8)}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    window.addEventListener('resize', publish)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--ds-toast-bottom')
    }
  }, [show, banners.length, showRequest, entry.prompt])
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
  const cardCount = Number(showRequest) + Number(Boolean(entry.prompt)) + banners.length

  // Rendered into <body> and fixed to the window (.ds-notification-stack:
  // above the bottom edge, 24px off the right edge, never wider than the
  // window), so no panel's overflow or transform can clip a card or its
  // dismiss button. "Dismiss all" sits on the same right edge.
  return createPortal(
    <aside ref={stackRef} data-notice-stack aria-label="High priority notifications" aria-live="polite" className="ds-notification-stack">
      {/* (One card closes with its own ×: "Dismiss all" is for a stack.) */}
      {cardCount > 1 && (
        <div className="flex shrink-0 justify-end">
          <button type="button" data-dismiss-all onClick={dismissAll} className="ds-intrinsic ds-notification-dismiss-all">알림 모두 닫기</button>
        </div>
      )}
      {showRequest && (
        <Notification
          type="info"
          icon={Bell}
          title={isNav ? '검토 요청 · Taylor' : '검토 요청 · Jordan'}
          body={isNav ? NAV_REQUEST_BODY : (comments.find((comment) => comment.id === 'comment-cc11') ?? seedComments.find((comment) => comment.id === 'comment-cc11'))?.text ?? ''}
          onDismiss={() => setRequestDismissed(true)}
          actions={[
            { label: '나중에', quiet: true, onClick: () => setRequestDismissed(true) },
            // The walkthrough's way in: its conflict starts from before the
            // review every time (opening it from the list shows it as it
            // stands).
            { label: '요청 검토하기', 'data-scenario-open': true, onClick: () => { const id = isNav ? 'cc-4' : 'cc-11'; setRequestDismissed(true); exitMergeStudio(); restartConflict(id); openConflictFromNotification(id) } },
          ]}
        />
      )}
      {entry.prompt && <ConflictEntryPromptCard prompt={entry.prompt} onOpen={entry.open} onClose={dismissEntry} />}
      {banners.map(n => (
        <Notification
          key={n.id}
          type="error"
          icon={Bell}
          title="위험도가 높아요. 바로 검토해 주세요."
          body={n.target.label}
          bodyClassName="line-clamp-2"
          onDismiss={() => dismiss(n.id)}
          actions={[
            { label: '나중에', quiet: true, onClick: () => dismiss(n.id) },
            {
              label: '읽지 않은 알림 보기',
              onClick: () => {
                dismiss(n.id)
                setMergeDrawer('inbox')
                // Open it right here when this page has a bell; otherwise go to
                // the Workspace, where the Inbox lives.
                if (!findBell()) navigate(`/projects/${projectId}/workspace`)
              },
            },
          ]}
        />
      ))}
    </aside>,
    document.body
  )
}
