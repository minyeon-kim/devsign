import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from '@/i18n/toast'
import { Bell } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ConflictEntryPromptCard, useConflictEntryPrompt } from '@/components/layout/ConflictEntryPrompt'
import { Notification } from '@/components/layout/Notification'
import { LocalizedText } from '@/i18n/runtime'
import { allPeople, currentUserFor } from '@/data/mockData'
import { shortDue } from '@/lib/conflicts'
import { DECISION_LABEL, requestBrief } from '@/lib/designDecisions'

// The on-screen Inbox bell (InboxButton tags itself), if any.
function findBell() {
  return document.querySelector('[data-inbox-button]')
}

// Walkthrough review requests that appear a few seconds after entering a
// project's Workspace. `restart` puts the conflict back before its review.
const NAV_REQUEST_DELAY_MS = 4000
// How long the notices stay up before going (they're kept in the Inbox).
const AUTO_HIDE_MS = 6000
// Each scenario's request: the conflict it's about.
const REQUESTS = {
  // (Dashboard Redesign: the designer gets Alex's request for a design
  // decision; the developer, the drift being detected on their code.)
  'dashboard-redesign': { conflictId: 'CON-002' },
  'mobile-nav-revamp': { conflictId: 'cc-4' },
  'checkout-redesign': { conflictId: 'cc-11' },
}

// A notification about one conflict, kept to what's needed: who and what in
// the title, the conflict and when it's due in one line, and the way in.
// (Why, and what to do there, are the review's to say.)
function ConflictNotice({ conflict, title, meta, type = 'info', onDismiss, actions }) {
  // ("Due tomorrow", in full: a bare "Tomorrow" doesn't say it's a deadline.)
  const due = shortDue(conflict.dueLabel) ? conflict.dueLabel : null
  return (
    <Notification
      type={type}
      icon={Bell}
      title={title}
      body={<>
        <LocalizedText text={conflict.title} />
        {due && <span className="ds-notification-meta"> · <LocalizedText text={due} /></span>}
      </>}
      bodyClassName="line-clamp-1"
      onDismiss={onDismiss}
      actions={actions}
    >
      {meta && <p data-notice-meta className="ds-notification-meta mt-1 pl-11 text-xs">{meta}</p>}
    </Notification>
  )
}

// A design decision's notice says who asked and where the work is (the
// designer's), or what was detected (the developer's).
const RISK_WORD = { high: '높음', medium: '보통', low: '낮음' }
function requestMeta(conflict, developer) {
  const request = conflict.decisionRequest ?? conflict.scriptedRequest
  if (developer) return `${conflict.id} · ${conflict.driftType === 'structural' ? 'Structural Drift' : '디자인 차이'} · 위험도 ${RISK_WORD[conflict.severity] ?? conflict.severity}`
  const requester = allPeople.find((person) => person.id === request?.by)?.name
  return [conflict.id, requester && `요청자 ${requester}`, requestBrief(request), `위험도 ${RISK_WORD[conflict.severity] ?? conflict.severity}`].filter(Boolean).join(' · ')
}

// Once a project's notices have been seen — dismissed, or gone on their
// own — they don't come back on returning to its Workspace (this browser
// session, reloads included): they're in the Inbox.
const SEEN_KEY = 'devsign:notices-seen:v1'
function readSeen() {
  try { return new Set(JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? '[]')) } catch { return new Set() }
}
function markSeen(...ids) {
  try {
    const seen = readSeen()
    ids.forEach((id) => seen.add(id))
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch { /* storage unavailable: they may show again */ }
}
const seenProjects = { has: (id) => readSeen().has(`project:${id}`), add: (id) => markSeen(`project:${id}`) }
const seenNotifications = { has: (id) => readSeen().has(`notice:${id}`), add: (id) => markSeen(`notice:${id}`) }

// Project-wide review banners survive navigation between project pages.
// Dismissing a banner leaves its review unread in the inbox.
export default function HighReviewNotifications() {
  const { conflicts, notifications, projectId, mergeDrawer, setMergeDrawer, exitMergeStudio, openConflictFromNotification, restartConflict, activeView } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [requestDismissed, setRequestDismissedState] = useState(() => seenProjects.has(projectId))
  const setRequestDismissed = (value) => { if (value) seenProjects.add(projectId); setRequestDismissedState(value) }
  const onWorkspace = /\/workspace\/?$/.test(pathname)
  const [navDue, setNavDue] = useState(false)
  const isNav = projectId === 'mobile-nav-revamp'
  useEffect(() => {
    if (!isNav || !onWorkspace) { setNavDue(false); return }
    const timer = window.setTimeout(() => setNavDue(true), NAV_REQUEST_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isNav, onWorkspace])
  const navResolved = conflicts.find((c) => c.id === 'cc-4')?.reviewStage === 'resolved'
  const request = REQUESTS[projectId] ?? null
  const requestConflict = request ? conflicts.find((c) => c.id === request.conflictId) : null
  const requester = allPeople.find((person) => person.id === (requestConflict?.requestedBy ?? requestConflict?.changedBy?.id))?.name ?? 'A teammate'
  const developer = currentUserFor(projectId).jobRole === 'Developer'
  const requestTitle = projectId === 'dashboard-redesign'
    ? (developer
      ? (requestConflict?.designDecision ? `${allPeople.find((person) => person.id === requestConflict.designDecision.by)?.name}님이 결정했어요: ${DECISION_LABEL[requestConflict.designDecision.choice]}` : `새 변경 확인이 자동 감지됐어요 · ${request?.conflictId}`)
      : `${requester} requested your review`)
    : `${requester} requested your review`
  const showRequest = onWorkspace && !requestDismissed && (projectId === 'checkout-redesign' || (projectId === 'dashboard-redesign' && requestConflict?.reviewStage !== 'resolved') || (isNav && navDue && !navResolved))
  const seen = useRef(seenNotifications)
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
  // Only on the Workspace itself — not over Merge Studio, the docs, history
  // or any other page — and only for a moment (see below): everything here
  // is also in the bell's Inbox, so nothing is lost when it goes.
  const inWorkspaceView = onWorkspace && activeView !== 'mergeStudio'
  const show = inWorkspaceView && (showRequest || banners.length > 0 || !!entry.prompt) && mergeDrawer !== 'inbox'
  const stackRef = useRef(null)
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
  // The stack leaves on its own after a while, unless it's being pointed at
  // (then it waits until the pointer leaves).
  const [hovering, setHovering] = useState(false)
  const dismissAllLater = useEffectEvent(() => dismissAll())
  useEffect(() => {
    if (!show || hovering) return
    const timer = window.setTimeout(dismissAllLater, AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [show, hovering])
  if (!show) return null
  const cardCount = Number(showRequest) + Number(Boolean(entry.prompt)) + banners.length

  // Rendered into <body> and fixed to the window (.ds-notification-stack:
  // above the bottom edge, 24px off the right edge, never wider than the
  // window), so no panel's overflow or transform can clip a card or its
  // dismiss button. "Dismiss all" sits on the same right edge.
  return createPortal(
    <aside ref={stackRef} data-notice-stack onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)} aria-label="High priority notifications" aria-live="polite" className="ds-notification-stack">
      {/* (One card closes with its own ×: "Dismiss all" is for a stack.) */}
      {cardCount > 1 && (
        <div className="flex shrink-0 justify-end">
          <button type="button" data-dismiss-all onClick={dismissAll} className="ds-intrinsic ds-notification-dismiss-all">알림 모두 닫기</button>
        </div>
      )}
      {showRequest && request && requestConflict && (
        <ConflictNotice
          conflict={requestConflict}
          title={requestTitle}
          meta={projectId === 'dashboard-redesign' && requestConflict.decisionFlow ? requestMeta(requestConflict, developer) : null}
          onDismiss={() => setRequestDismissed(true)}
          actions={[
            { label: 'Later', quiet: true, onClick: () => setRequestDismissed(true) },
            // The walkthrough's way in: its conflict starts from before the
            // review every time (opening it from the list shows it as it
            // stands).
            { label: 'Open the conflict', 'data-scenario-open': true, onClick: () => { const id = request.conflictId; setRequestDismissed(true); exitMergeStudio(); restartConflict(id); openConflictFromNotification(id) } },
          ]}
        />
      )}
      {entry.prompt && <ConflictEntryPromptCard prompt={entry.prompt} onOpen={entry.open} onClose={dismissEntry} />}
      {banners.map(n => {
        const conflict = conflicts.find((c) => c.id === n.target?.conflictId)
        const dismissThis = { label: 'Later', quiet: true, onClick: () => dismiss(n.id) }
        // (With its conflict at hand: that conflict, said plainly, and the
        // way straight to it. Otherwise the Inbox, where it's listed.)
        return conflict ? (
          <ConflictNotice
            key={n.id}
            type="error"
            conflict={conflict}
            title="A high-risk change needs your review"
            onDismiss={() => dismiss(n.id)}
            actions={[dismissThis, { label: 'Open the conflict', onClick: () => { dismiss(n.id); exitMergeStudio(); openConflictFromNotification(conflict.id) } }]}
          />
        ) : (
          <Notification
            key={n.id}
            type="error"
            icon={Bell}
            title="A high-risk change needs your review"
            body={n.target.label}
            bodyClassName="line-clamp-2"
            onDismiss={() => dismiss(n.id)}
            actions={[
              dismissThis,
              {
                label: 'See it in the Inbox',
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
        )
      })}
    </aside>,
    document.body
  )
}
