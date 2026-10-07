import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { comments as seedComments } from '@/data/mockData'
import { Bell } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ConflictEntryPromptCard, useConflictEntryPrompt } from '@/components/layout/ConflictEntryPrompt'
import { Notification } from '@/components/layout/Notification'

// Where the banners stack when the page has no Inbox bell (Merge Studio,
// Docs, …): the top-right corner, under the header row.
const FALLBACK_ANCHOR = { top: 56, right: 16 }
// The least room kept between the cards and the window's right edge.
const EDGE_GAP = 16
// Room inside the stack for the cards' shadows: it scrolls, so anything
// past its own box would be clipped.
const STACK_PAD = 12

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
      // (A bell that's hidden measures as nothing: the fallback corner then.)
      // Never closer to the window's edge than EDGE_GAP, wherever the bell
      // is — a card flush with the edge reads as cut off.
      setAnchor(rect?.width ? { top: rect.bottom + 8, right: Math.max(EDGE_GAP, window.innerWidth - rect.right) } : FALLBACK_ANCHOR)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    // The bell moves when the layout around it does (a drawer opening, a
    // panel resizing) without the window changing size.
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      observer.disconnect()
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
    // The stack is at most 360px of cards and never wider than the window
    // less EDGE_GAP on each side. Its own padding (STACK_PAD, taken back out
    // of its offsets) keeps the cards' shadows — and so their edges — from
    // being clipped by its scroll box.
    <aside
      ref={stackRef}
      data-notice-stack
      aria-label="High priority notifications"
      aria-live="polite"
      style={{
        top: anchor.top - STACK_PAD,
        right: anchor.right - STACK_PAD,
        padding: STACK_PAD,
        width: `min(${360 + STACK_PAD * 2}px, calc(100vw - ${(EDGE_GAP - STACK_PAD) * 2}px))`,
        maxHeight: `calc(100dvh - ${anchor.top - STACK_PAD + 16}px)`,
      }}
      className="pointer-events-none fixed z-[1100] box-border flex flex-col gap-2 overflow-y-auto overscroll-contain"
    >
      <div className="pointer-events-auto sticky top-0 z-20 flex shrink-0 justify-end">
        <button type="button" onClick={dismissAll} className="ds-intrinsic ds-notification-action shadow-md">알림 모두 닫기</button>
      </div>
      {showRequest && (
        <Notification
          type="info"
          icon={Bell}
          title="검토 요청 · Jordan"
          body={(comments.find((comment) => comment.id === 'comment-cc11') ?? seedComments.find((comment) => comment.id === 'comment-cc11'))?.text ?? ''}
          onDismiss={() => setRequestDismissed(true)}
          actions={[
            { label: '나중에', quiet: true, onClick: () => setRequestDismissed(true) },
            // The walkthrough's way in: its conflict starts from before the
            // review every time (opening it from the list shows it as it
            // stands).
            { label: '요청 검토하기', 'data-scenario-open': true, onClick: () => { setRequestDismissed(true); exitMergeStudio(); restartConflict('cc-11'); openConflictReview('cc-11'); setBottomPanel({ tab: 'conflict', open: true }) } },
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
    </aside>
  )
}
