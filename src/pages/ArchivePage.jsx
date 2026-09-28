import { useLocation, useOutletContext } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'
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

// Reads `project` from ProjectLayout's <Outlet context> (the shared
// WorkspaceProvider ancestor is what lets the History tab reuse
// RollbackHistoryList verbatim). `location.state` carries the deep-link
// set by Workspace's SaveStatusIndicator — which tab to land on and which
// record to scroll to/highlight.
function ArchivePage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const initialTab = location.state?.tab === 'history' ? 'history' : 'referenceDocs'
  const highlightId = location.state?.highlightId

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <div>
          <p className="text-[15px] font-semibold text-foreground">Archive</p>
          <p className="text-[11px] text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
        <Tabs defaultValue={initialTab} className="flex h-full min-h-0 flex-col">
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
            <RollbackHistoryList highlightId={highlightId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ArchivePage
