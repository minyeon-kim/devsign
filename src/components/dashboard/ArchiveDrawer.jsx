import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, FileText, GitCommitHorizontal, History, Library, Palette } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

const itemClass =
  'flex h-8 min-w-0 items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeClass = 'bg-muted text-foreground'

const STAGE_DOT = { update: 'bg-amber-400', documented: 'bg-sky-400', archived: 'bg-emerald-400' }

// Which Archive section / item the current route shows (null outside it).
function currentView(location, archivePath) {
  if (!location.pathname.startsWith(archivePath)) return null
  const state = location.state ?? {}
  if (state.tab === 'history' || state.highlightId) return { section: 'history', itemId: state.highlightId }
  if (state.tab === 'dsUpdates') return { section: 'dsUpdates' }
  if (state.tab === 'referenceDocs' || state.docId) return { section: 'referenceDocs', itemId: state.docId }
  return { section: null }
}

// One accordion section: the chevron expands / collapses its items in
// place; the name opens the section's own view in the main area.
function Section({ id, label, icon: Icon, count, open, onToggle, to, state, active, children }) {
  return (
    <div>
      <div className={cn('group flex h-9 items-center rounded-lg transition-colors hover:bg-muted', active && activeClass)}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`archive-${id}`}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground/70 hover:text-foreground"
        >
          <ChevronRight className={cn('size-3.5 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-90')} />
        </button>
        <Link
          to={to}
          state={state}
          replace={false}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex h-9 min-w-0 flex-1 items-center gap-2 pr-2.5 text-[13px] font-medium text-muted-foreground group-hover:text-foreground',
            active && 'text-foreground'
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count > 0 && <span className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">{count}</span>}
        </Link>
      </div>
      <div
        id={`archive-${id}`}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 mb-1 ml-[21px] flex flex-col gap-0.5 border-l border-white/[0.06] pl-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

// Archive views share one URL (the view is in `location.state`), and a Link
// to the same URL replaces the history entry by default — `replace={false}`
// makes each pick a real step, so the header's ‹ › move between them.
//
// The drawer behind the activity bar's Archive icon, as an accordion tree:
// Design System Updates, Reference Docs and History each expand in place
// to list their updates / docs / versions, instead of navigating into a
// separate level. The section a route is showing starts expanded. Titles
// and paths live only in the main area's header — the drawer carries no
// breadcrumb — and moving back / forward is the drawer header's ‹ › icons.
function ArchiveDrawer({ project }) {
  const location = useLocation()
  const { historyEntries, activeHistoryId, referenceDocs, dsUpdates } = useWorkspace()
  const archivePath = `/projects/${project.id}/archive`
  const view = currentView(location, archivePath)
  const history = [...historyEntries].filter((e) => !e.archived).reverse()

  const [open, setOpen] = useState(() => new Set([view?.section ?? 'referenceDocs']))
  // Arriving on a section from elsewhere expands it too.
  const [seenSection, setSeenSection] = useState(view?.section)
  if (view?.section !== seenSection) {
    setSeenSection(view?.section)
    if (view?.section && !open.has(view.section)) setOpen((prev) => new Set(prev).add(view.section))
  }

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sectionActive = (id) => view?.section === id && !view.itemId

  return (
    <nav aria-label="Archive" className="flex flex-col gap-0.5 pb-2">
      <Section
        id="dsUpdates"
        label="Design System Updates"
        icon={Palette}
        count={dsUpdates.filter((u) => u.stage !== 'archived').length}
        open={open.has('dsUpdates')}
        onToggle={() => toggle('dsUpdates')}
        to={archivePath}
        state={{ tab: 'dsUpdates' }}
        active={sectionActive('dsUpdates')}
      >
        {dsUpdates.map((update) => (
          <Link key={update.id} to={archivePath} replace={false} state={{ tab: 'dsUpdates' }} title={update.summary} className={itemClass}>
            <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT[update.stage])} />
            <span className="min-w-0 truncate">{update.title}</span>
          </Link>
        ))}
      </Section>

      <Section
        id="referenceDocs"
        label="Reference Docs"
        icon={Library}
        count={referenceDocs.length}
        open={open.has('referenceDocs')}
        onToggle={() => toggle('referenceDocs')}
        to={archivePath}
        state={{ tab: 'referenceDocs' }}
        active={sectionActive('referenceDocs')}
      >
        {referenceDocs.map((doc) => {
          const active = view?.section === 'referenceDocs' && view.itemId === doc.id
          return (
            <Link
              key={doc.id}
              to={archivePath}
              state={{ tab: 'referenceDocs', docId: doc.id }}
              replace={false}
              aria-current={active ? 'page' : undefined}
              title={doc.title}
              className={cn(itemClass, active && activeClass)}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{doc.title}</span>
            </Link>
          )
        })}
      </Section>

      <Section
        id="history"
        label="History"
        icon={History}
        count={history.length}
        open={open.has('history')}
        onToggle={() => toggle('history')}
        to={archivePath}
        state={{ tab: 'history' }}
        active={sectionActive('history')}
      >
        {history.map((entry) => {
          const active = view?.section === 'history' && view.itemId === entry.id
          return (
            <Link
              key={entry.id}
              to={archivePath}
              state={{ tab: 'history', highlightId: entry.id }}
              replace={false}
              aria-current={active ? 'page' : undefined}
              title={`${entry.label} · ${entry.timestamp}`}
              className={cn(itemClass, active && activeClass)}
            >
              <GitCommitHorizontal className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {entry.id === activeHistoryId && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Current" />}
            </Link>
          )
        })}
      </Section>
    </nav>
  )
}

export default ArchiveDrawer
