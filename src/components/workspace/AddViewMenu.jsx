import { WORKSPACE_TAB_RADIUS } from '@/components/mergestudio/floatingStyles'
import { useRef, useState } from 'react'
import { AppWindow, ArrowLeft, ChevronRight, FileCode, FileText, Monitor, Plus, ScrollText, Sparkles, SquareTerminal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addDockPanel, panelById } from '@/components/dockview/DockLayout'
import { buildDocTree, docPath, searchDocs } from '@/lib/docCategories'
import { documentTarget, openWorkspaceDocument } from '@/lib/workspaceDocuments'
import { toast } from '@/i18n/toast'
import { useWorkspace } from '@/state/WorkspaceProvider'

const VIEWS = [
  { def: panelById.editor, label: 'Code Editor', icon: FileCode },
  { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
  { def: panelById.preview, label: 'Preview', icon: Monitor },
  { def: panelById.chat, label: 'AI Chat', icon: Sparkles },
  { def: panelById.terminal, label: 'Terminal', icon: SquareTerminal },
  { def: panelById.console, label: 'Console', icon: ScrollText },
]

// Opens `def` as a tab of window `group` — or brings it forward if it's
// already here. A view open elsewhere moves here (a panel lives in one
// window at a time).
function openHere(dockApi, group, def) {
  const existing = dockApi.getPanel(def.id)
  if (existing?.group?.id === group.id) {
    existing.api.setActive()
    return
  }
  existing?.api.close()
  addDockPanel(dockApi, def, { position: { referenceGroup: group.id } })
}

// The `+` right after a window's last tab (Cursor style): a small,
// non-blocking popover anchored under it listing the views to open here
// as a tab — Code Editor, Canvas, Preview, AI Chat, Terminal, Console,
// Docs documents and local files. The default tab bar has no Preview tab; this is where one is
// added as a pane tab. To give a view its own pane, drag its tab to a pane's edge.
function AddViewMenu({ group, dockApi }) {
  const { importFiles, referenceDocs, setChatTargetOverride } = useWorkspace()
  const fileInput = useRef(null)
  const [picker, setPicker] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const tree = buildDocTree(referenceDocs)
  const docs = searchDocs(referenceDocs, query)

  function changeOpen(value) {
    setOpen(value)
    if (!value) { setPicker(null); setQuery('') }
  }

  async function loadFile(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setLoading(true)
    try {
      const result = await importFiles(files)
      if (result.code) openHere(dockApi, group, panelById.editor)
      changeOpen(false)
    } catch {
      toast('Couldn’t open the file', { description: 'Pick the file again.' })
    } finally { setLoading(false) }
  }

  function pickDoc(doc) {
    openWorkspaceDocument(dockApi, doc, { referencePanel: group.activeId, direction: 'within' })
    setChatTargetOverride(documentTarget(doc))
    changeOpen(false)
  }
  const [open, setOpen] = useState(false)

  function pick(def) {
    openHere(dockApi, group, def)
    changeOpen(false)
  }

  return (
    <>
    <input ref={fileInput} type="file" multiple accept=".js,.jsx,.ts,.tsx,.css,.scss,.json,.md,.html,.py,.svelte,.vue,.csv,.tsv,.txt" className="hidden" onChange={loadFile} />
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        title="Open a view"
        aria-label="Open a view"
        className={`${WORKSPACE_TAB_RADIUS} flex size-8 shrink-0 items-center justify-center bg-transparent text-slate-400 transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60`}
      >
        <Plus className="size-4" strokeWidth={2.25} />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={picker ? 'w-80 gap-2 rounded-xl p-2' : 'w-48 gap-0 rounded-xl p-1'}>
        {picker === 'docs' ? <>
          <button type="button" onClick={() => { setPicker(null); setQuery('') }} className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/[0.06]"><ArrowLeft className="size-3.5" />Docs 페이지 열기</button>
          <input autoFocus aria-label="Docs 문서 검색" placeholder="문서 제목, 내용 또는 경로 검색" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 w-full rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs outline-none focus:border-white/25" />
          <div className="max-h-72 overflow-y-auto">
            {docs.map((doc) => <button key={doc.id} type="button" onClick={() => pickDoc(doc)} title={doc.title} className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white">
              <FileText className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1"><span className="block truncate">{doc.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{['Docs', ...(docPath(tree, doc.id) ?? [])].join(' / ')}</span></span>
            </button>)}
            {!docs.length && <p className="px-2 py-4 text-xs text-slate-500">검색 결과가 없습니다.</p>}
          </div>
        </> : <>
          <button type="button" disabled={loading} onClick={() => fileInput.current?.click()} title="컴퓨터에서 파일을 선택해 이 작업창에 열기" className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"><FileCode className="size-4 text-slate-400" />{loading ? '파일 여는 중…' : 'File'}</button>
          <button type="button" onClick={() => setPicker('docs')} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 hover:bg-white/[0.06] hover:text-white"><FileText className="size-4 text-slate-400" /><span className="flex-1">Docs</span><ChevronRight className="size-3.5 text-slate-500" /></button>
          <div className="my-1 border-t border-white/[0.06]" />
        {VIEWS.map(({ def, label, icon: Icon }) => {
          const here = group.panelIds.includes(def.id)
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => pick(def)}
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Icon className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {here && <span className="ds-status-dot shrink-0 rounded-full bg-emerald-400" aria-label="Open here" />}
            </button>
          )
        })}
        </>}
      </PopoverContent>
    </Popover>
    </>
  )
}

export default AddViewMenu
