import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, FileCode2, GitMerge, History, Palette, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ACCENT_CTA, GHOST_BUTTON } from '@/components/mergestudio/floatingStyles'
import { activities, allPeople } from '@/data/mockData'
import { STAGE_DOT_CLASS, STAGE_LABEL, isOpen } from '@/lib/conflicts'
import { DS_STAGES } from '@/lib/designSystemUpdates'
import { projectTone } from '@/lib/projectTone'
import { useWorkspace } from '@/state/WorkspaceProvider'

function Section({ title, action, children }) {
  return (
    <section className="rounded-2xl bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SectionLink({ to, state, children }) {
  return (
    <Link to={to} state={state} className="flex items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-white">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  )
}

function Stat({ label, value, hint, children }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold text-white tabular-nums">{value}</p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
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
  const { conflicts, openConflictReview, dsUpdates, historyEntries, activeHistoryId, referenceDocs, setBottomPanel } =
    useWorkspace()
  const workspacePath = `/projects/${project.id}/workspace`
  const archivePath = `/projects/${project.id}/archive`

  const openConflicts = conflicts.filter(isOpen)
  const recentActivity = activities.filter((a) => a.projectId === project.id).slice(0, 5)
  const recentHistory = [...historyEntries].filter((e) => !e.archived).reverse().slice(0, 3)
  const stageCounts = dsUpdates.reduce((acc, u) => ({ ...acc, [u.stage]: (acc[u.stage] ?? 0) + 1 }), {})

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-10">
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
            <h1 className="text-xl font-semibold tracking-tight text-white">{project.name}</h1>
            <p className="mt-1 text-[13px] text-slate-400">{project.description}</p>
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
            <button
              type="button"
              onClick={() => navigate(workspacePath, { state: { openMergeStudio: true } })}
              className={cn('inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium', GHOST_BUTTON)}
            >
              <Sparkles className="size-4 text-emerald-300" />
              Merge Studio
            </button>
            <Link to={workspacePath} className={cn('inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold', ACCENT_CTA)}>
              Open Workspace
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Design ↔ code sync" value={`${project.syncProgress}%`}>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${project.syncProgress}%` }} />
            </div>
          </Stat>
          <Stat label="Open Conflict Points" value={openConflicts.length} hint={`${conflicts.length - openConflicts.length} resolved`} />
          <Stat
            label="Design system updates"
            value={dsUpdates.filter((u) => u.stage !== 'archived').length}
            hint="in progress"
          />
          <Stat label="Files" value={project.filesCount} hint={`${project.pendingMerges} pending merge${project.pendingMerges === 1 ? '' : 's'}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <Section
              title="Open Conflict Points"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setBottomPanel({ tab: 'conflict', open: true })
                    navigate(workspacePath)
                  }}
                  className="flex items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  In Workspace
                  <ChevronRight className="size-3.5" />
                </button>
              }
            >
              {openConflicts.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">No open Conflict Points — design and code are in sync.</p>
              ) : (
                <div className="-mx-2 flex flex-col gap-0.5">
                  {openConflicts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      // Conflicts are inspected and resolved only in the
                      // Workspace's Conflict Points tab: go there, open it.
                      onClick={() => {
                        setBottomPanel({ tab: 'conflict', open: true })
                        openConflictReview(c.id)
                        navigate(workspacePath)
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT_CLASS[c.reviewStage])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-slate-100">{c.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-500">
                          <FileCode2 className="size-3 shrink-0" />
                          <span className="truncate">{c.file}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">{STAGE_LABEL[c.reviewStage]}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Recent activity" action={<SectionLink to="/activity">All activity</SectionLink>}>
              {recentActivity.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">Nothing yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 text-xs">
                      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', a.actorColorClass)}>
                        {a.actorInitials}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-400">
                        <span className="font-medium text-slate-200">{a.actorName}</span> {a.action}{' '}
                        <span className="text-slate-200">{a.target}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">{a.timestamp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="flex flex-col gap-4">
            <Section
              title="Design system pipeline"
              action={
                <SectionLink to={archivePath} state={{ tab: 'dsUpdates' }}>
                  Open
                </SectionLink>
              }
            >
              <ol className="flex flex-col gap-2">
                {DS_STAGES.map((stage, i) => {
                  const Icon = [Palette, BookOpen, History][i]
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
                <SectionLink to={archivePath} state={{ tab: 'referenceDocs' }}>
                  All docs
                </SectionLink>
              }
            >
              <div className="-mx-2 flex flex-col gap-0.5">
                {referenceDocs.slice(0, 4).map((doc) => (
                  <Link
                    key={doc.id}
                    to={archivePath}
                    state={{ tab: 'referenceDocs', docId: doc.id }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <BookOpen className="size-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">{doc.updatedAtLabel}</span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section
              title="Recent versions"
              action={
                <SectionLink to={archivePath} state={{ tab: 'history' }}>
                  History
                </SectionLink>
              }
            >
              <div className="-mx-2 flex flex-col gap-0.5">
                {recentHistory.map((entry) => (
                  <Link
                    key={entry.id}
                    to={archivePath}
                    state={{ tab: 'history', highlightId: entry.id }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <GitMerge className="size-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
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
    </div>
  )
}

export default ProjectOverviewPage
