import { Link, useLocation } from 'react-router-dom'
import { FileText, History, Library, Palette } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

const rowClass =
  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const childRowClass =
  'flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const activeClass = 'bg-muted text-foreground'

function Count({ value }) {
  if (!value) return null
  return <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">{value}</span>
}

// The drawer behind the activity bar's Archive icon: the Archive's
// sections as navigation, in pipeline order — Design System Updates (a
// change), Reference Docs (its documentation, with each doc under it) and
// History (where it's recorded). Picking one renders that view in the
// main area (the Archive page, deep-linked through `location.state`); the
// Archive icon itself never jumps straight into content.
function ArchiveDrawer({ project }) {
  const location = useLocation()
  const { historyEntries, referenceDocs, dsUpdates } = useWorkspace()
  const archivePath = `/projects/${project.id}/archive`
  const onArchive = location.pathname.startsWith(archivePath)
  const state = onArchive ? (location.state ?? {}) : null
  const onHistory = state?.tab === 'history' || Boolean(state?.highlightId)
  const onDsUpdates = state?.tab === 'dsUpdates'
  const docId = state && !onHistory && !onDsUpdates ? state.docId : null
  const onDocsIndex = Boolean(state) && !onHistory && !onDsUpdates && !docId
  const historyCount = historyEntries.filter((e) => !e.archived).length
  const pendingUpdates = dsUpdates.filter((u) => u.stage !== 'archived').length

  return (
    <nav aria-label="Archive" className="flex flex-col gap-1">
      <Link
        to={archivePath}
        state={{ tab: 'dsUpdates' }}
        aria-current={onDsUpdates ? 'page' : undefined}
        className={cn(rowClass, 'mb-2', onDsUpdates && activeClass)}
      >
        <Palette className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">Design System Updates</span>
        <Count value={pendingUpdates} />
      </Link>
      <Link
        to={archivePath}
        state={{ tab: 'referenceDocs' }}
        aria-current={onDocsIndex ? 'page' : undefined}
        className={cn(rowClass, onDocsIndex && activeClass)}
      >
        <Library className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">Reference Docs</span>
        <Count value={referenceDocs.length} />
      </Link>
      <div className="ml-[17px] flex flex-col gap-0.5 border-l border-white/[0.06] pl-2">
        {referenceDocs.map((doc) => (
          <Link
            key={doc.id}
            to={archivePath}
            state={{ tab: 'referenceDocs', docId: doc.id }}
            aria-current={docId === doc.id ? 'page' : undefined}
            className={cn(childRowClass, docId === doc.id && activeClass)}
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{doc.title}</span>
          </Link>
        ))}
      </div>

      <Link
        to={archivePath}
        state={{ tab: 'history' }}
        aria-current={onHistory ? 'page' : undefined}
        className={cn(rowClass, 'mt-2', onHistory && activeClass)}
      >
        <History className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">History</span>
        <Count value={historyCount} />
      </Link>
    </nav>
  )
}

export default ArchiveDrawer
