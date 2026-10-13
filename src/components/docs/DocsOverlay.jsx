import { useEffect, useRef } from 'react'
import { FileText, X } from 'lucide-react'
import { cn } from 'cn'
import Breadcrumb, { BREADCRUMB_COLUMN, BreadcrumbBar } from '@/components/layout/Breadcrumb'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReferenceDocView, { DOC_TYPES } from '@/components/archive/ReferenceDocView'
import DesignSystemUpdates from '@/components/archive/DesignSystemUpdates'
import { buildDocTree, docPath } from '@/lib/docCategories'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allPeople } from '@/data/mockData'

// The layer's content column: the path's own (BREADCRUMB_COLUMN — the same left line as the
// top bar), starting 8px under the bar — where a change's detail has its title row.
const COLUMN = cn(BREADCRUMB_COLUMN, 'pt-2 pb-10')

// One doc in the index — a borderless row that opens it.
function DocRow({ doc, onOpen }) {
  const author = allPeople.find((p) => p.id === doc.authorId)
  const type = DOC_TYPES[doc.type] ?? DOC_TYPES.doc

  return (
    <button
      type="button"
      onClick={() => onOpen(doc.id)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', type.tone)}>
        <FileText className="size-3.5 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{doc.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{doc.summary ?? `Updated ${doc.updatedAtLabel}`}</p>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{doc.updatedAtLabel}</span>
      {author && (
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback className={cn('text-[10px] font-medium text-white', author.colorClass)}>{author.initials}</AvatarFallback>
        </Avatar>
      )}
    </button>
  )
}

// One category of the index, with its sub-categories one level in.
function DocsGroup({ node, depth, onOpen }) {
  return (
    <section className={cn(depth === 0 ? 'mt-6 first:mt-0' : 'mt-3')}>
      <h2
        className={cn(
          'mb-1 px-3',
          depth === 0 ? 'text-[12px] font-semibold tracking-wide text-slate-400 uppercase' : 'text-[13px] font-medium text-slate-300'
        )}
      >
        {node.label}
      </h2>
      <div className={cn(depth > 0 && 'ml-3 border-l border-white/[0.06] pl-2')}>
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
function DocsIndex({ tree, onOpen }) {
  return (
    // (In the page's column: its rows are inset 12px, so they're pulled out by as much — their text starts on the path's line.)
    <div data-docs-index className={COLUMN}>
      <div className="-mx-3 max-w-3xl">
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
  const { referenceDocs, docParam, docsParam, openDoc, openDocs, closeDocs, requestDocsDrawer, openHistory: openHistoryLayer } = useWorkspace()
  const language = useLanguage()
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
  // "문서": where you are. From a document (or the updates) it goes to the list; the drawer comes up if it's been closed.
  const toIndex = () => { requestDocsDrawer(); if (view.kind !== 'index') openDocs({ docs: 'index' }) }
  // (To the History layer, on that checkpoint: a step of its own — Back returns here.)
  const openHistory = (checkpointId) => openHistoryLayer(checkpointId ?? null, { flash: true })

  return (
    <div data-docs-overlay={view.kind} role="dialog" aria-label="Docs" className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      <BreadcrumbBar className="h-16 pt-0" rowClassName="h-12">
        <Breadcrumb
          items={[
            { label: 'Workspace', onClick: closeDocs },
            ...(view.kind === 'dsUpdates'
              ? [{ label: 'Docs', onClick: toIndex }, { label: 'Document updates' }]
              : [{ label: 'Docs', onClick: toIndex }]),
          ]}
        />
        <button
          ref={closeRef}
          type="button"
          data-docs-overlay-close
          aria-label="Close"
          title={`${translateText('Close', language)} · Esc`}
          onClick={closeDocs}
          className="ds-intrinsic ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <X className="size-4" />
        </button>
      </BreadcrumbBar>
      <div data-docs-scroll className="min-h-0 flex-1 overflow-y-auto">
        {view.kind === 'doc' && <ReferenceDocView key={view.doc.id} doc={view.doc} path={docPath(tree, view.doc.id) ?? []} frameClassName={cn(COLUMN, 'flex gap-8')} />}
        {view.kind === 'dsUpdates' && <div className={COLUMN}><DesignSystemUpdates onOpenDoc={openDoc} onOpenHistory={openHistory} className="px-0 py-0" /></div>}
        {view.kind === 'index' && <DocsIndex tree={tree} onOpen={openDoc} />}
      </div>
    </div>
  )
}

export default DocsOverlay
