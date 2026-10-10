import { notificationDestination } from '@/lib/inboxNotifications'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ACCENT_CTA, FLOATING_PILL, PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import { activities, allPeople } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { isOpen, isPendingMerge, needsReviewFrom } from '@/lib/conflicts'
import ConflictRow from '@/components/conflicts/ConflictRow'
import MergeCancellationSummary from '@/components/conflicts/MergeCancellationSummary'
import { projectTone } from '@/lib/projectTone'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useConflictStore } from '@/state/ConflictStore'
import UserPresence from '@/components/layout/UserPresence'
import MergeInboxDrawer, { InboxButton } from '@/components/mergestudio/MergeInboxDrawer'

function Section({ title, action, children }) {
  return (
    <section className="min-w-0 border-t border-white/[0.08] pt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-white"><LocalizedText text={title} /></h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SectionLink({ to, state, onClick, children }) {
  const content = <><LocalizedText text={children} /><ArrowRight aria-hidden className="size-3 opacity-70" /></>
  return onClick
    ? <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">{content}</button>
    : <Link to={to} state={state} className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">{content}</Link>
}

function relativeTime(createdAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function timeValue(timestamp, createdAt) {
  if (Number.isFinite(createdAt)) return createdAt
  const now = new Date()
  const relative = /^(\d+)(m|h|d) ago$/.exec(timestamp ?? '')
  if (relative) {
    const multiplier = { m: 60000, h: 3600000, d: 86400000 }[relative[2]]
    return now.getTime() - Number(relative[1]) * multiplier
  }
  if (/^(Now|Today)$/.test(timestamp ?? '')) return now.getTime()

  const clock = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/.exec(timestamp ?? '')
  if (clock) {
    const date = new Date(now)
    let hour = Number(clock[1]) % 12
    if (clock[3] === 'PM') hour += 12
    date.setHours(hour, Number(clock[2]), 0, 0)
    if (date > now) date.setDate(date.getDate() - 1)
    return date.getTime()
  }

  const match = /^(Today|Yesterday|Last week|Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:, (\d{1,2}):(\d{2}) (AM|PM))?$/.exec(timestamp ?? '')
  if (!match) return 0
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const date = new Date(now)
  if (match[1] === 'Yesterday') date.setDate(date.getDate() - 1)
  else if (match[1] === 'Last week') date.setDate(date.getDate() - 7)
  else if (days[match[1]] !== undefined) {
    const diff = (date.getDay() - days[match[1]] + 7) % 7 || 7
    date.setDate(date.getDate() - diff)
  }
  if (match[2]) {
    let hour = Number(match[2]) % 12
    if (match[4] === 'PM') hour += 12
    date.setHours(hour, Number(match[3]), 0, 0)
  }
  return date.getTime()
}

const EVENT_ACTION = {
  approve: 'approved',
  changes: 'requested changes on',
  merge: 'merged',
  revert: 'opened a revert of',
  review_requested: 'requested a review for',
  code_change: 'updated',
  comment: 'commented on',
  dismiss: 'closed the review for',
  reopened: 'reopened',
  decision_requested: 'asked for a design decision on',
  decided: 'made a design decision on',
}

function activityVerb(action, type) {
  if (action?.startsWith('requested your review')) return 'requested your review for'
  if (action?.startsWith('flagged a design')) return 'detected a difference in'
  if (action?.startsWith('changed')) return 'updated'
  if (action?.startsWith('commented')) return 'commented on'
  return EVENT_ACTION[type] ?? action ?? type
}

const SHORT_EVENT_VERB = {
  approved: 'approved',
  'requested changes on': 'requested changes',
  merged: 'merged',
  'opened a revert of': 'opened a revert',
  'requested a review for': 'requested a review',
  'requested your review for': 'requested a review',
  'detected a difference in': 'detected a difference',
  updated: 'updated',
  'commented on': 'commented',
  'closed the review for': 'closed the review',
  reopened: 'reopened',
}

function ProjectTimeline({ activities: liveActivities, history, conflicts, historyPath, onOpenConflict, onOpenActivity }) {
  const tokenFor = (entry) => {
    const targetFile = entry.target?.split(' · ')[0]
    const conflict = conflicts.find((item) => item.id === entry.conflictId)
      ?? conflicts.find((item) => targetFile && item.file?.endsWith(targetFile))
    return conflict?.token ?? entry.target ?? entry.title ?? entry.label
  }
  const entries = [
    ...liveActivities.map((item) => ({
      ...item,
      kind: 'activity',
      conflict: conflicts.find((conflict) => conflict.id === item.conflictId) ?? null,
      actor: item.actorName ?? allPeople.find((person) => person.id === item.actorId)?.name ?? 'Devsign',
      verb: item.type === 'merge' && conflicts.find((conflict) => conflict.id === item.conflictId)?.revertOf
        ? 'canceled the merge of'
        : activityVerb(item.action, item.type),
      token: tokenFor(item),
      timestamp: item.timestamp,
    })),
    ...history.map((item) => ({
      ...item,
      kind: 'version',
      versionKind: item.kind,
      actor: item.actorLabel ?? allPeople.find((person) => person.id === item.actorId)?.name ?? null,
      token: tokenFor(item),
      timestamp: item.timestamp,
    })),
  ].sort((a, b) => timeValue(b.timestamp, b.createdAt) - timeValue(a.timestamp, a.createdAt)).slice(0, 8)

  const groups = []
  const byToken = new Map()
  for (const entry of entries) {
    const key = entry.token || entry.id
    let group = byToken.get(key)
    if (!group) {
      group = { token: key, entries: [] }
      byToken.set(key, group)
      groups.push(group)
    }
    group.entries.push(entry)
  }

  if (!entries.length) return <p className="py-3 text-xs text-slate-500"><LocalizedText text="Nothing yet." /></p>

  return (
    <ol className="relative ml-1 border-l border-white/[0.08]">
      {groups.map((group) => (
        <li key={group.token} className="relative py-2 pl-4">
              <span aria-hidden className="absolute top-[17px] -left-1 size-2 rounded-full bg-slate-500 ring-4 ring-background" />
          <h3 className="truncate text-xs font-medium text-slate-200"><LocalizedText text={group.token} /></h3>
          <ul className="mt-1">
            {group.entries.map((entry) => {
              const sentence = entry.kind !== 'activity' ? null
                : entry.verb === 'canceled the merge of' || entry.verb === 'opened a revert of'
                  ? `${entry.actor} ${entry.verb} ${entry.token}`
                  : `${entry.actor} ${SHORT_EVENT_VERB[entry.verb] ?? entry.verb}`
              const versionLabel = entry.versionKind === 'conflict' ? 'Conflict detected' : entry.label
              const time = entry.createdAt
                ? relativeTime(entry.createdAt)
                : entry.timestamp === 'Just now' ? null : entry.timestamp
              const content = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs text-slate-400">
                      {sentence
                        ? <LocalizedText text={sentence} />
                        : <><LocalizedText text={versionLabel} />{entry.actor && <> · <LocalizedText text={entry.actor} /></>}</>}
                    </span>
                    {entry.kind === 'activity' && entry.conflict?.revertOf && <MergeCancellationSummary conflict={entry.conflict} conflicts={conflicts} />}
                  </span>
                  {time && <span className="shrink-0 text-[10px] text-slate-500"><LocalizedText text={time} /></span>}
                </>
              )
              return (
                <li key={entry.id}>
                  {entry.kind === 'version' ? (
                    <Link to={historyPath} state={{ highlightId: entry.id }} className="flex min-w-0 items-center gap-3 py-1.5 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => entry.conflict ? onOpenConflict(entry.conflict) : onOpenActivity()} className="flex w-full min-w-0 cursor-pointer items-center gap-3 py-1.5 text-left hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function Person({ id }) {
  const person = allPeople.find((p) => p.id === id)
  if (!person) return null
  return (
    <Avatar size="sm" className="ring-2 ring-background" title={`${person.name} · ${person.role}`}>
      <AvatarFallback className={cn('text-[10px] font-semibold text-white', person.colorClass)}>{person.initials}</AvatarFallback>
    </Avatar>
  )
}

// A project's landing page — Home inside a project comes here, and so
// does opening a project from the dashboard or the project list — before
// the Workspace itself: what state the project is in (sync, open Conflict
// Points, the design system pipeline), what changed recently, and one
// clear way into the Workspace. It lives under the same ProjectLayout as
// Workspace and Archive, so moving between them keeps the project's live
// state (reviews, edits, history) instead of reloading it.
function ProjectOverviewPage() {
  const { project } = useOutletContext()
  const navigate = useNavigate()
  const { conflicts, mergeItems, historyEntries, referenceDocs, setBottomPanel, currentUser, mergeDrawer, setMergeDrawer } = useWorkspace()
  const { events } = useConflictStore()
  const workspacePath = `/projects/${project.id}/workspace`
  const docsPath = `/projects/${project.id}/docs`
  const historyPath = `/projects/${project.id}/history`
  // The same Inbox bell + drawer as the Workspace/Merge Studio header
  // (MergeInboxDrawer) — Project home had no notifications at all before,
  // not a smaller version of this one. An item here isn't on-screen yet,
  // so jumping to it goes through the Workspace's own nav-state handler
  // (see WorkspacePage) instead of focusing the canvas directly.
  // Shared with the Workspace (mergeDrawer) so the high-priority banners
  // know when the Inbox is already open and stay out of its way.
  const inboxOpen = mergeDrawer === 'inbox'

  // Everything below counts from the shared conflict store with the same
  // rules as the Workspace list (lib/conflicts), so the numbers, the list
  // and the Workspace's filters always agree. Merged items leave the open
  // list; approved ones stay in it, as "Approved · Pending merge".
  const merged = conflicts.filter((conflict) => conflict.reviewStage === 'resolved')
  const pendingMerge = conflicts.filter(isPendingMerge)
  const decisions = conflicts.filter((conflict) => conflict.reviewStage !== 'resolved' && !isPendingMerge(conflict))
  const total = conflicts.length
  const openConflicts = conflicts
    .filter(isOpen)
    .sort((a, b) => Number(needsReviewFrom(b)) - Number(needsReviewFrom(a)))
  const decisionIds = new Set(decisions.map((conflict) => conflict.id))
  const mergeConflicts = openConflicts.filter(isPendingMerge)
  const decisionConflicts = openConflicts.filter((conflict) => decisionIds.has(conflict.id))

  // A conflict opens in the Workspace: Conflict Points tab, its review
  // window, and its element and file selected (see WorkspacePage).
  function openConflict(conflict) {
    navigate(workspacePath, { state: { openConflictId: conflict.id } })
  }

  // A stat opens the Workspace's Conflict Points list with the matching filter.
  function openList(filter) {
    setBottomPanel({ tab: 'conflict', open: true, conflictFilter: filter })
    navigate(workspacePath)
  }
  const recentHistory = [...historyEntries].filter((entry) => !entry.archived).reverse().slice(0, 6)
  const projectActivities = activities.filter((activity) => activity.projectId === project.id)
  const projectEvents = events.filter((event) => event.projectId === project.id).map((event) => ({
    ...event,
    actorName: event.actorId === currentUser.id ? 'You' : allPeople.find((person) => person.id === event.actorId)?.name ?? 'Devsign',
    type: event.kind,
    action: EVENT_ACTION[event.kind],
    timestamp: event.timeLabel,
  }))
  const timelineActivities = [...projectEvents, ...projectActivities]

  return (
    <div className="relative h-full min-w-0 overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-10">
        <nav aria-label="Project navigation" className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          <Link to="/dashboard" className="shrink-0 hover:text-white"><LocalizedText text="Dashboard" /></Link>
          <ChevronRight className="size-3" />
          <span aria-current="page" className="truncate text-white">{project.name}</span>
          {/* Same profile popover and Inbox as the Workspace's top bar —
              Project home had no way to switch user, see who's on the
              project, or check notifications until you opened the
              Workspace; this closes that gap instead of growing separate,
              smaller implementations of them. */}
          <span className="ml-auto flex items-center gap-2">
            <div className={cn('flex h-8 items-center gap-2 rounded-full px-2', FLOATING_PILL, 'border-0 bg-white/[0.04]')}>
              <span className={PRESENCE_STACK}>
                <UserPresence />
              </span>
            </div>
            <InboxButton open={inboxOpen} onToggle={() => setMergeDrawer(inboxOpen ? null : 'inbox')} />
          </span>
        </nav>
        {/* Header */}
        <header className="flex flex-wrap items-start gap-4">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-white',
              projectTone(project.id)
            )}
          >
            {project.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words [overflow-wrap:anywhere] text-xl font-semibold tracking-tight text-white">{project.name}</h1>
            <p title={project.description} className="mt-1 truncate text-[13px] text-slate-400">{project.description}</p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              {/* Overlapped just enough that every initial still reads. */}
              <div className="flex shrink-0 -space-x-0.5">
                {project.memberIds.map((id) => (
                  <Person key={id} id={id} />
                ))}
              </div>
              <span className="truncate text-xs text-slate-500"><LocalizedText text="Updated" /> <LocalizedText text={project.updatedAtLabel} /></span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={workspacePath} aria-description="Open the code and design workspace" className={cn('inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold', ACCENT_CTA)}>
              <LocalizedText text="Open Workspace" />
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <div aria-label="Conflict progress" className="space-y-2 border-t border-white/[0.08] pt-4">
          {total > 0 && (
            <div role="img" aria-label={`Completed ${merged.length}, pending merge ${pendingMerge.length}, decision needed ${decisions.length}`} className="flex h-1 overflow-hidden rounded-full bg-white/[0.06]">
              {merged.length > 0 && <span className="bg-emerald-400" style={{ width: `${merged.length / total * 100}%` }} />}
              {pendingMerge.length > 0 && <span className="bg-sky-400" style={{ width: `${pendingMerge.length / total * 100}%` }} />}
              {decisions.length > 0 && <span className="bg-white/20" style={{ width: `${decisions.length / total * 100}%` }} />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {merged.length > 0 && <button type="button" onClick={() => openList('done')} className="text-slate-400 transition-colors hover:text-white"><LocalizedText text="Done" /> {merged.length}</button>}
            {pendingMerge.length > 0 && <button type="button" onClick={() => openList('pending_merge')} className="text-sky-300 transition-colors hover:text-white"><LocalizedText text="Pending merge" /> {pendingMerge.length}</button>}
            {decisions.length > 0 && <button type="button" onClick={() => openList('open')} className="text-slate-300 transition-colors hover:text-white"><LocalizedText text="Decision needed" /> {decisions.length}</button>}
            {total === 0 && <span className="text-xs text-slate-500"><LocalizedText text="No conflicts to review." /></span>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-7">
            <Section
              title="What to do now"
              action={<SectionLink onClick={() => openList('open')}>View all</SectionLink>}
            >
              {mergeConflicts.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-1 text-xs font-medium text-slate-300"><LocalizedText text="Pending merge" /> <span className="text-slate-500 tabular-nums">{mergeConflicts.length}</span></h3>
                  <ul className="divide-y divide-white/[0.06]">
                    {mergeConflicts.map((conflict) => <li key={conflict.id}><ConflictRow conflict={conflict} conflicts={conflicts} onOpen={openConflict} /></li>)}
                  </ul>
                </div>
              )}
              {decisionConflicts.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-medium text-slate-300"><LocalizedText text="Decision needed" /> <span className="text-slate-500 tabular-nums">{decisionConflicts.length}</span></h3>
                  <ul className="divide-y divide-white/[0.06]">
                    {decisionConflicts.map((conflict) => <li key={conflict.id}><ConflictRow conflict={conflict} conflicts={conflicts} onOpen={openConflict} /></li>)}
                  </ul>
                </div>
              )}
              {openConflicts.length === 0 && <p className="py-3 text-xs text-slate-500"><LocalizedText text="No conflicts to review." /></p>}
            </Section>
            {merged.length > 0 && (
              <Section title="Recently merged" action={<SectionLink onClick={() => openList('done')}>View all</SectionLink>}>
                <ul className="divide-y divide-white/[0.06]">
                  {merged.slice(-4).reverse().map((conflict) => <li key={conflict.id}><ConflictRow conflict={conflict} conflicts={conflicts} onOpen={openConflict} /></li>)}
                </ul>
              </Section>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-7">
            <Section
              title="Recent activity"
              action={
                <span className="flex items-center gap-3">
                  <SectionLink to="/activity">All activity</SectionLink>
                  <SectionLink to={historyPath}>History</SectionLink>
                </span>
              }
            >
              <ProjectTimeline
                activities={timelineActivities}
                history={recentHistory}
                conflicts={conflicts}
                historyPath={historyPath}
                onOpenConflict={openConflict}
                onOpenActivity={() => navigate('/activity')}
              />
            </Section>

            {referenceDocs.length > 0 && (
              <Section title="Reference docs" action={<SectionLink to={docsPath}>All docs</SectionLink>}>
                <ul className="divide-y divide-white/[0.06]">
                  {referenceDocs.slice(0, 4).map((doc) => (
                    <li key={doc.id}>
                      <Link to={docsPath} state={{ docId: doc.id }} className="flex min-w-0 items-center gap-2 py-2 text-xs text-slate-300 transition-colors hover:text-white">
                        <BookOpen aria-hidden className="size-3.5 shrink-0 text-slate-500" />
                        <span title={doc.title} className="min-w-0 flex-1 truncate"><LocalizedText text={doc.title} /></span>
                        <span className="shrink-0 text-[10px] text-slate-500"><LocalizedText text={doc.updatedAtLabel} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
      {inboxOpen && (
        <MergeInboxDrawer
          onJump={(n) => {
            const destination = notificationDestination(n.target, conflicts, mergeItems)
            if (!destination) return
            setMergeDrawer(null)
            navigate(workspacePath, { state: destination.conflictId
              ? { openConflictId: destination.conflictId, fromNotification: true }
              : { ...destination.mergeTarget, openMergeStudio: true, mergeItemId: destination.mergeTarget.itemId } })
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}
    </div>
  )
}

export default ProjectOverviewPage
