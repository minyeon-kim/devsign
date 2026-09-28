import { useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'
import HistoryCompare from '@/components/history/HistoryCompare'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useShellDrawer } from '@/components/dashboard/AppShell'
import { allPeople, referenceDocs } from '@/data/mockData'

const DOC_TONES = { design: 'bg-indigo-500', spec: 'bg-sky-500', doc: 'bg-emerald-500' }

function ReferenceDocCard({ doc }) {
  const author = allPeople.find((p) => p.id === doc.authorId)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          DOC_TONES[doc.type] ?? 'bg-muted-foreground'
        )}
      >
        <FileText className="size-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{doc.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Updated {doc.updatedAtLabel}</p>
      </div>
      {author && (
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback className={cn('text-[10px] font-medium text-white', author.colorClass)}>
            {author.initials}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// Project-level History — this project's own saved versions, to compare
// against the current one and restore — as opposed to the global Activity
// feed, which aggregates what everyone did across every project. The
// list selects; the pane beside it compares and restores.
function HistoryTab({ highlightId }) {
  const { activeHistoryId } = useWorkspace()
  const [selectedId, setSelectedId] = useState(highlightId ?? activeHistoryId)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <div className="flex min-h-0 flex-col overflow-y-auto pr-1">
        <RollbackHistoryList highlightId={highlightId} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="min-h-[320px] lg:min-h-0">
        <HistoryCompare entryId={selectedId} />
      </div>
    </div>
  )
}

// Reads `project` from ProjectLayout's <Outlet context> (the shared
// WorkspaceProvider ancestor is what lets the History tab reuse
// RollbackHistoryList verbatim). `location.state` carries the deep-link
// set by Workspace's SaveStatusIndicator — which tab to land on and which
// record to preselect, scroll to and highlight.
function ArchivePage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const initialTab = location.state?.tab === 'history' ? 'history' : 'referenceDocs'
  const highlightId = location.state?.highlightId
  const { drawerOpen } = useShellDrawer()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        {/* Just "Archive" while the sidebar drawer is open (its switcher
            already names the project); collapsed, the project name slides
            in ahead of it as a breadcrumb so the context isn't lost. */}
        <div className="flex min-w-0 items-center text-[15px] font-semibold">
          <span
            aria-hidden={drawerOpen}
            className={cn(
              'flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none',
              drawerOpen ? 'mr-0 max-w-0 opacity-0' : 'mr-2 max-w-[320px] opacity-100'
            )}
          >
            <span className="min-w-0 truncate text-muted-foreground">{project.name}</span>
            <span className="shrink-0 font-normal text-muted-foreground/60">/</span>
          </span>
          <p className="shrink-0 text-foreground">Archive</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
        {/* Keyed by the navigation so a fresh deep-link re-applies its tab
            and record even if Archive was already mounted. */}
        <Tabs key={location.key} defaultValue={initialTab} className="flex h-full min-h-0 flex-col">
          <TabsList className="w-fit shrink-0">
            <TabsTrigger value="referenceDocs">Reference Docs</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="referenceDocs" className="mt-4 min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col gap-2">
              {referenceDocs.map((doc) => (
                <ReferenceDocCard key={doc.id} doc={doc} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="mb-3 shrink-0 text-xs text-muted-foreground">
              Saved versions of {project.name}. Select one to compare it with the current version, then restore it if needed.
            </p>
            <HistoryTab highlightId={highlightId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ArchivePage
