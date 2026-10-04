import { Sparkles } from 'lucide-react'
import ReferenceDocView from '@/components/archive/ReferenceDocView'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import { documentTarget } from '@/lib/workspaceDocuments'
import { useWorkspace } from '@/state/WorkspaceProvider'

export default function DocumentPanel({ params }) {
  const { referenceDocs, dockApi, setChatTargetOverride } = useWorkspace()
  const doc = referenceDocs.find((entry) => entry.id === params.docId)
  if (!doc) return <p className="p-6 text-sm text-muted-foreground">Document not found</p>
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="text-xs text-muted-foreground">Docs</span>
        <button type="button" title="이 문서에 대해 AI에게 질문" onClick={() => {
          setChatTargetOverride(documentTarget(doc))
          if (dockApi) openOrFocusPanel(dockApi, panelById.chat)
        }} className="flex h-8 items-center gap-2 rounded-full bg-white/[0.06] px-3 text-xs text-foreground hover:bg-white/10">
          <Sparkles className="size-3.5 text-primary" />이 문서에 대해 질문
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto"><ReferenceDocView doc={doc} /></div>
    </div>
  )
}
