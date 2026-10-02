import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, GitMerge, History, FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ACCENT_CTA, FLOATING_PILL, PAGE_CARD, PRESENCE_STACK } from '@/components/mergestudio/floatingStyles'
import { allPeople } from '@/data/mockData'
import { conflictCounts, isOpen, needsReviewFrom } from '@/lib/conflicts'
import { historyMeta } from '@/lib/historyMeta'
import ConflictRow from '@/components/conflicts/ConflictRow'
import ActivityList from '@/components/conflicts/ActivityList'
import { DOCUMENT_STAGES as DS_STAGES } from '@/lib/documentChanges'
import { projectTone } from '@/lib/projectTone'
import { useWorkspace } from '@/state/WorkspaceProvider'
import UserPresence from '@/components/layout/UserPresence'
import MergeInboxDrawer, { InboxButton } from '@/components/mergestudio/MergeInboxDrawer'

function Section({ title, action, children }) {
  return (
    <section className={cn(PAGE_CARD, 'min-w-0 overflow-hidden p-6')}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SectionLink({ to, state, children }) {
  return (
    <Link to={to} state={state} className="flex shrink-0 items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-white">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  )
}

// A count with what it counts spelled out (`title`), linking to exactly
// the items it counts.
function Stat({ label, value, hint, title, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(PAGE_CARD, 'min-w-0 overflow-hidden p-6 text-left transition-colors hover:border-emerald-400/25 hover:bg-muted/60')}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-1.5 text-[22px] font-semibold tabular-nums', tone ?? 'text-white')}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </button>
  )
}

function Person({ id }) {
  const person = allPeople.find((p) => p.id === id)
  if (!person) return null
  return (
    <Avatar size="sm" className="ring-2 ring-background" title={person.name}>
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
  const { conflicts, dsUpdates, historyEntries, activeHistoryId, referenceDocs, setBottomPanel, currentUser, mergeDrawer, setMergeDrawer } = useWorkspace()
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
  const counts = conflictCounts(conflicts)
  const openConflicts = conflicts
    .filter(isOpen)
    .sort((a, b) => Number(needsReviewFrom(b)) - Number(needsReviewFrom(a)))

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
  const recentHistory = [...historyEntries].filter((e) => !e.archived).reverse().slice(0, 3)
  const stageCounts = dsUpdates.reduce((acc, u) => ({ ...acc, [u.stage]: (acc[u.stage] ?? 0) + 1 }), {})

  return (
    <div className="relative h-full min-w-0 overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-10">
        <nav aria-label="Project navigation" className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/dashboard" className="rounded-full px-3 py-2 hover:bg-white/[0.06] hover:text-white">Dashboard</Link>
          <ChevronRight className="size-3" />
          <span aria-current="page" className="text-white">Project home</span>
          <ChevronRight className="size-3" />
          <Link to={workspacePath} className="rounded-full px-3 py-2 hover:bg-white/[0.06] hover:text-white">Workspace</Link>
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
            <p className="mt-1 break-words [overflow-wrap:anywhere] text-[13px] text-slate-400">{project.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {project.memberIds.map((id) => (
                  <Person key={id} id={id} />
                ))}
              </div>
              <span className="text-xs text-slate-500">Updated {project.updatedAtLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={workspacePath} aria-description="Open the code and design workspace" className={cn('inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold', ACCENT_CTA)}>
              Open Workspace
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        {/* Stats — counts of Conflict Points (design ↔ code differences),
            never a percentage without a basis. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Open design ↔ code differences"
            value={counts.open}
            hint={counts.highOpen ? `${counts.highOpen} high risk` : 'None high risk'}
            title="Conflict Points not merged yet"
            onClick={() => openList('open')}
          />
          <Stat
            label="Needs your review"
            value={counts.needsMyReview}
            tone={counts.needsMyReview ? 'text-emerald-300' : undefined}
            hint="You're a required reviewer"
            onClick={() => openList('mine')}
          />
          <Stat
            label="Approved · Pending merge"
            value={counts.pendingMerge}
            hint="All required approvals received"
            onClick={() => openList('pending_merge')}
          />
          <Stat label="Merged" value={counts.merged} hint="Applied to the code" onClick={() => openList('merged')} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Section
              title="Open Conflict Points"
              action={
                <button
                  type="button"
                  onClick={() => openList('open')}
                  className="flex shrink-0 items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  In Workspace
                  <ChevronRight className="size-3.5" />
                </button>
              }
            >
              {openConflicts.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">No open Conflict Points.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {openConflicts.map((c) => (
                    <ConflictRow key={c.id} conflict={c} onOpen={openConflict} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Recent activity" action={<SectionLink to="/activity">All activity</SectionLink>}>
              <ActivityList projectId={project.id} onOpenConflict={openConflict} inset />
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Section
              title="Document updates"
              action={
                <SectionLink to={docsPath} state={{ tab: 'dsUpdates' }}>
                  Open
                </SectionLink>
              }
            >
              <ol className="flex flex-col gap-2">
                {DS_STAGES.map((stage, i) => {
                  const Icon = [FileText, BookOpen, History][i]
                  return (
                    <li key={stage.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 text-xs">
                      <Icon className="size-3.5 text-emerald-300" />
                      <span className="flex-1 text-slate-300">{stage.label}</span>
                      <span className="font-semibold text-white tabular-nums">{stageCounts[stage.id] ?? 0}</span>
                    </li>
                  )
                })}
              </ol>
            </Section>

            <Section
              title="Reference docs"
              action={
                <SectionLink to={docsPath}>
                  All docs
                </SectionLink>
              }
            >
              <div className="flex flex-col gap-0.5">
                {referenceDocs.slice(0, 4).map((doc) => (
                  <Link
                    key={doc.id}
                    to={docsPath}
                    state={{ docId: doc.id }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <BookOpen className="size-3.5 shrink-0 text-slate-500" />
                    <span title={doc.title} className="min-w-0 flex-1 truncate">{doc.title}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">{doc.updatedAtLabel}</span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section
              title="Recent versions"
              action={
                <SectionLink to={historyPath}>
                  History
                </SectionLink>
              }
            >
              <div className="flex flex-col gap-0.5">
                {recentHistory.map((entry) => (
                  <Link
                    key={entry.id}
                    to={historyPath}
                    state={{ highlightId: entry.id }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <GitMerge className="size-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span title={entry.label} className="block truncate">{entry.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {[historyMeta(entry, currentUser.id), entry.timestamp].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {entry.id === activeHistoryId && (
                      <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-px text-[10px] font-semibold text-emerald-300">Current</span>
                    )}
                  </Link>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
      {inboxOpen && (
        <MergeInboxDrawer
          onJump={(n) => {
            setMergeDrawer(null)
            if (n.target.conflictId) {
              navigate(workspacePath, { state: { openConflictId: n.target.conflictId } })
              return
            }
            navigate(workspacePath, {
              state: {
                openMergeStudio: true,
                mergeItemId: n.target.itemId,
                layerId: n.target.layerId,
                fileId: n.target.fileId,
                line: n.target.line,
              },
            })
          }}
          onClose={() => setMergeDrawer(null)}
        />
      )}
    </div>
  )
}

export default ProjectOverviewPage
