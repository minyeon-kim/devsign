import { useEffect, useRef } from 'react'
import { FileText } from 'lucide-react'
import { cn } from 'cn'
import { PageTitle } from '@/components/layout/PagePieces'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReferenceDocView, { DOC_TYPES } from '@/components/archive/ReferenceDocView'
import DesignSystemUpdates from '@/components/archive/DesignSystemUpdates'
import { buildDocTree, docPath } from '@/lib/docCategories'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allPeople } from '@/data/mockData'

// The layer's reading column: in the middle of the layer (a document's own is the same
// width), 24px under the bar, room at its foot. The path keeps the top bar's left line;
// what's read sits in the middle.
const READING = 'mx-auto w-full max-w-[760px] px-6 pt-6 pb-24'

// One doc in the index — a borderless row that opens it.
function DocRow({ doc, onOpen }) {
  const author = allPeople.find((p) => p.id === doc.authorId)
  const type = DOC_TYPES[doc.type] ?? DOC_TYPES.doc

  return (
    <button
      type="button"
      onClick={() => onOpen(doc.id)}
      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      {/* (As the Workspace's lists: a neutral icon, the title over one quiet line, when and who at the right.) */}
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
        <FileText className="size-3.5 text-slate-300" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-100">{doc.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{doc.summary ?? `Updated ${doc.updatedAtLabel}`}</p>
      </div>
      <span className="shrink-0 text-[12px] text-slate-500">{doc.updatedAtLabel}</span>
      {author && (
        <Avatar size="xs" className="shrink-0" title={type.label}>
          <AvatarFallback className={cn('text-[8px] font-medium text-white', author.colorClass)}>{author.initials}</AvatarFallback>
        </Avatar>
      )}
    </button>
  )
}

// One category of the index, with its sub-categories one level in.
function DocsGroup({ node, depth, onOpen }) {
  return (
    // (A category: its name as the other pages' section titles — no capitals — and its documents in the windows'
    // card; a sub-category is a quiet label inside that card, with no rule down its side.)
    <section className={cn(depth === 0 ? 'mt-7 first:mt-0' : 'mt-2 first:mt-0')}>
      <h2
        className={cn(
          depth === 0 ? 'mb-2.5 text-[13px] font-semibold text-slate-300' : 'px-3 pt-1.5 pb-1 text-[12px] font-medium text-slate-500'
        )}
      >
        {node.label}
      </h2>
      <div className={cn(depth === 0 && 'rounded-[24px] border border-white/10 bg-card p-1.5')}>
        {node.docs.map((doc) => (
          <DocRow key={doc.id} doc={doc} onOpen={onOpen} />
        ))}
        {node.children.map((child) => (
          <DocsGroup key={child.id} node={child} depth={depth + 1} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

// All docs, grouped by the same category tree as the Docs sidebar.
function DocsIndex({ tree, onOpen, count }) {
  return (
    <div data-docs-index className={READING}>
      <PageTitle title="All docs" count={count} className="mb-5" />
      <div>
        {tree.map((node) => (
          <DocsGroup key={node.id} node={node} depth={0} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// Which view the address names (lib/docLink): `?doc=<id>` a document,
// `?docs=updates` the Document updates pipeline, `?docs=index` the
// categorized list. A document that isn't there (an old or mistyped id) is
// the list.
function resolveView(docId, docsView, referenceDocs) {
  const doc = docId && referenceDocs.find((d) => d.id === docId)
  if (doc) return { kind: 'doc', doc }
  if (docId) return { kind: 'index' }
  if (docsView === 'updates') return { kind: 'dsUpdates' }
  return docsView ? { kind: 'index' } : null
}

// Docs — the project's Reference Docs and the Document updates pipeline that
// generates new ones — as a layer over the Workspace: it covers the work area
// while the activity bar and the Docs drawer (the category tree) stay. What's
// shown is the address's (`?doc`, `?docs`), so it survives a reload, can be
// shared, and Back closes it — the same way a change's detail works
// (ConflictReviewOverlay), and with the same top bar: against the top of the
// screen, 48px tall in a 64px place, the path at its left and Close at its
// right. The path says where this is — 워크스페이스 › 문서 — and its first item
// goes where Close goes; the project and a document's categories aren't in it
// (the category path is the document's own meta line).
function DocsOverlay() {
  const { referenceDocs, docParam, docsParam, openDoc, closeDocs, openHistory: openHistoryLayer } = useWorkspace()
  const view = resolveView(docParam, docsParam, referenceDocs)
  const open = Boolean(view)
  const closeRef = useRef(null)

  // (Read when Esc is pressed — not a reason to run the effect again.)
  const close = useRef(closeDocs)
  useEffect(() => { close.current = closeDocs })
  useEffect(() => {
    if (!open) return undefined
    // Focus comes in with it, and goes back to where it was on closing.
    const before = document.activeElement
    closeRef.current?.focus()
    function onKey(event) {
      // (A dialog or menu opened from inside closes itself first — and Esc in the drawer's search clears the search.)
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]')) return
      if (event.target instanceof HTMLInputElement && event.target.type === 'search' && event.target.value) return
      close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [open])

  if (!view) return null
  const tree = buildDocTree(referenceDocs)
  // (To the History layer, on that checkpoint: a step of its own — Back returns here.)
  const openHistory = (checkpointId) => openHistoryLayer(checkpointId ?? null, { flash: true })

  return (
    <div ref={closeRef} tabIndex={-1} data-docs-overlay={view.kind} role="dialog" aria-label="Docs" className="absolute top-[var(--ds-chrome-size)] right-2 bottom-2 left-0 z-[650] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-card outline-none text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* (No bar of its own: the app's top bar says where this is — … › 워크스페이스 › 문서. Esc closes it.) */}
      <div data-docs-scroll className="min-h-0 flex-1 overflow-y-auto pt-4">
        {view.kind === 'doc' && <ReferenceDocView key={view.doc.id} doc={view.doc} path={docPath(tree, view.doc.id) ?? []} page />}
        {view.kind === 'dsUpdates' && <div data-docs-updates className={READING}><DesignSystemUpdates onOpenDoc={openDoc} onOpenHistory={openHistory} className="px-0 py-0" /></div>}
        {view.kind === 'index' && <DocsIndex tree={tree} onOpen={openDoc} count={referenceDocs.length} />}
      </div>
    </div>
  )
}

export default DocsOverlay
