import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, GitCommitHorizontal, History, Library, Palette } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const itemClass =
  'flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeClass = 'bg-muted text-foreground'

const STAGE_DOT = { update: 'bg-amber-400', documented: 'bg-sky-400', archived: 'bg-emerald-400' }

function Count({ value }) {
  if (!value) return null
  return <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">{value}</span>
}

// Which Archive section (and item) the current route shows, or null on
// the Archive home / outside the Archive.
function currentSection(location, archivePath) {
  if (!location.pathname.startsWith(archivePath)) return null
  const state = location.state ?? {}
  if (state.tab === 'history' || state.highlightId) return { id: 'history', itemId: state.highlightId }
  if (state.tab === 'dsUpdates') return { id: 'dsUpdates' }
  if (state.tab === 'referenceDocs' || state.docId) return { id: 'referenceDocs', itemId: state.docId }
  return null
}

// The drawer behind the activity bar's Archive icon, as two levels:
//   · the section list — Design System Updates, Reference Docs, History
//     (pipeline order: a change → its documentation → where it's
//     recorded); picking one opens it in the main area;
//   · inside a section, a "← Archive" back row, the section's name, and
//     its items (each doc / version / update) to move between them. Back
//     returns to the section list and the Archive home.
function ArchiveDrawer({ project }) {
  const location = useLocation()
  const { historyEntries, activeHistoryId, referenceDocs, dsUpdates } = useWorkspace()
  const archivePath = `/projects/${project.id}/archive`
  const section = currentSection(location, archivePath)
  const history = [...historyEntries].filter((e) => !e.archived).reverse()
  const pendingUpdates = dsUpdates.filter((u) => u.stage !== 'archived').length

  if (!section) {
    return (
      <nav aria-label="Archive" className="flex flex-col gap-1">
        {[
          ['dsUpdates', 'Design System Updates', Palette, pendingUpdates],
          ['referenceDocs', 'Reference Docs', Library, referenceDocs.length],
          ['history', 'History', History, history.length],
        ].map(([tab, label, Icon, count]) => (
          <Link key={tab} to={archivePath} state={{ tab }} className={cn(rowClass, 'group')}>
            <Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <Count value={count} />
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
          </Link>
        ))}
      </nav>
    )
  }

  const titles = { dsUpdates: 'Design System Updates', referenceDocs: 'Reference Docs', history: 'History' }

  return (
    <nav aria-label={titles[section.id]} className="flex flex-col gap-1 animate-in fade-in slide-in-from-right-1 duration-150 motion-reduce:animate-none">
      <Link
        to={archivePath}
        className="mb-1 flex h-8 w-fit items-center gap-1 rounded-full pr-3 pl-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Archive
      </Link>

      {/* The section itself — its index view in the main area. */}
      <Link
        to={archivePath}
        state={{ tab: section.id }}
        aria-current={!section.itemId ? 'page' : undefined}
        className={cn(rowClass, 'text-foreground', !section.itemId && activeClass)}
      >
        {section.id === 'dsUpdates' ? (
          <Palette className="size-3.5 shrink-0" />
        ) : section.id === 'history' ? (
          <History className="size-3.5 shrink-0" />
        ) : (
          <Library className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 truncate">{titles[section.id]}</span>
      </Link>

      <div className="ml-[17px] flex flex-col gap-0.5 border-l border-white/[0.06] pl-2">
        {section.id === 'referenceDocs' &&
          referenceDocs.map((doc) => (
            <Link
              key={doc.id}
              to={archivePath}
              state={{ tab: 'referenceDocs', docId: doc.id }}
              aria-current={section.itemId === doc.id ? 'page' : undefined}
              className={cn(itemClass, section.itemId === doc.id && activeClass)}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{doc.title}</span>
            </Link>
          ))}

        {section.id === 'history' &&
          history.map((entry) => (
            <Link
              key={entry.id}
              to={archivePath}
              state={{ tab: 'history', highlightId: entry.id }}
              aria-current={section.itemId === entry.id ? 'page' : undefined}
              title={`${entry.label} · ${entry.timestamp}`}
              className={cn(itemClass, section.itemId === entry.id && activeClass)}
            >
              <GitCommitHorizontal className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {entry.id === activeHistoryId && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Current" />}
            </Link>
          ))}

        {section.id === 'dsUpdates' &&
          dsUpdates.map((update) => (
            <div key={update.id} className={itemClass} title={update.summary}>
              <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT[update.stage])} />
              <span className="min-w-0 truncate">{update.title}</span>
            </div>
          ))}
      </div>
    </nav>
  )
}

export default ArchiveDrawer
