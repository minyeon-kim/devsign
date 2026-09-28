import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'
import HistoryCompare from '@/components/history/HistoryCompare'
import ReferenceDocView, { DOC_TYPES } from '@/components/archive/ReferenceDocView'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allPeople, referenceDocs } from '@/data/mockData'

// The Reference Docs index — shown when no single doc is picked. Each card
// opens that doc (the same deep link the Archive drawer uses).
function ReferenceDocCard({ doc, onOpen }) {
  const author = allPeople.find((p) => p.id === doc.authorId)
  const type = DOC_TYPES[doc.type] ?? DOC_TYPES.doc

  return (
    <button
      type="button"
      onClick={() => onOpen(doc.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', type.tone)}>
        <FileText className="size-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{doc.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {doc.summary ?? `Updated ${doc.updatedAtLabel}`}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{doc.updatedAtLabel}</span>
      {author && (
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback className={cn('text-[10px] font-medium text-white', author.colorClass)}>
            {author.initials}
          </AvatarFallback>
        </Avatar>
      )}
    </button>
  )
}

// Project-level History — this project's own saved versions, to compare
// against the current one and restore — as opposed to the global Activity
// feed, which aggregates what everyone did across every project. The
// list selects; the pane beside it compares and restores.
function HistoryView({ project, highlightId }) {
  const { activeHistoryId } = useWorkspace()
  const [selectedId, setSelectedId] = useState(highlightId ?? activeHistoryId)

  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-5">
      <p className="mb-3 shrink-0 text-xs text-muted-foreground">
        Saved versions of {project.name}. Select one to compare it with the current version, then restore it if needed.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div className="flex min-h-0 flex-col overflow-y-auto pr-1">
          <RollbackHistoryList highlightId={highlightId} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="min-h-[320px] lg:min-h-0">
          <HistoryCompare entryId={selectedId} />
        </div>
      </div>
    </div>
  )
}

// Which Archive view to show, read from the link that opened it (the
// Archive drawer's Reference Docs / History items, or Workspace's
// save-status link) — no in-page tabs; the drawer is the navigation.
function resolveView(state) {
  const doc = state?.docId && referenceDocs.find((d) => d.id === state.docId)
  if (doc) return { kind: 'doc', doc }
  if (state?.tab === 'history' || state?.highlightId) return { kind: 'history', highlightId: state.highlightId }
  return { kind: 'docs' }
}

function Crumb({ children, onClick, current }) {
  if (current) return <span className="min-w-0 truncate text-foreground">{children}</span>
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </button>
  )
}

function CrumbSeparator() {
  return <span className="shrink-0 font-normal text-muted-foreground/60">/</span>
}

// Reads `project` from ProjectLayout's <Outlet context> (the shared
// WorkspaceProvider ancestor is what lets History reuse RollbackHistoryList
// verbatim). `location.state` says what to show: `{ docId }` renders that
// reference doc as a readable page, `{ tab: 'history', highlightId? }` the
// version compare view, and nothing the Reference Docs index.
function ArchivePage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const view = resolveView(location.state)
  const archivePath = `/projects/${project.id}/archive`

  const openDoc = (docId) => navigate(archivePath, { state: { tab: 'referenceDocs', docId } })
  const openDocsIndex = () => navigate(archivePath, { state: { tab: 'referenceDocs' } })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        {/* Breadcrumb: Project / Archive / section / doc ("Archive"
            returns to the Reference Docs index). */}
        <div className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
          <span className="flex max-w-[320px] min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
            <span className="min-w-0 truncate text-muted-foreground">{project.name}</span>
            <CrumbSeparator />
          </span>
          <Crumb onClick={openDocsIndex}>Archive</Crumb>
          <CrumbSeparator />
          {view.kind === 'history' ? (
            <Crumb current>History</Crumb>
          ) : (
            <Crumb current={view.kind === 'docs'} onClick={openDocsIndex}>
              Reference Docs
            </Crumb>
          )}
          {view.kind === 'doc' && (
            <>
              <CrumbSeparator />
              <Crumb current>{view.doc.title}</Crumb>
            </>
          )}
        </div>
      </div>

      {/* Keyed by the navigation so a fresh deep link re-applies its view
          and record even if Archive was already mounted — and fades the
          content in, so picking an item in the sidebar's Archive tree
          loads it here lightly rather than as a hard swap. */}
      <div
        key={location.key}
        className="min-h-0 flex-1 animate-in overflow-y-auto fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
      >
        {view.kind === 'doc' && <ReferenceDocView doc={view.doc} />}
        {view.kind === 'history' && <HistoryView project={project} highlightId={view.highlightId} />}
        {view.kind === 'docs' && (
          <div className="px-6 py-5">
            <div className="flex max-w-3xl flex-col gap-2">
              {referenceDocs.map((doc) => (
                <ReferenceDocCard key={doc.id} doc={doc} onOpen={openDoc} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ArchivePage
