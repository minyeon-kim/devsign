import { FileText } from 'lucide-react'
import { cn } from 'cn'
import Breadcrumb, { BreadcrumbBar, projectCrumbs } from '@/components/layout/Breadcrumb'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReferenceDocView, { DOC_TYPES } from '@/components/archive/ReferenceDocView'
import DesignSystemUpdates from '@/components/archive/DesignSystemUpdates'
import { buildDocTree, docPath } from '@/lib/docCategories'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allPeople, projects } from '@/data/mockData'
import { useNavigate } from 'react-router-dom'

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
    <div className="max-w-3xl px-6 py-5">
      {tree.map((node) => (
        <DocsGroup key={node.id} node={node} depth={0} onOpen={onOpen} />
      ))}
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
// (ConflictReviewOverlay).
function DocsOverlay() {
  const { projectId, referenceDocs, docParam, docsParam, openDoc, openDocs } = useWorkspace()
  const navigate = useNavigate()
  const view = resolveView(docParam, docsParam, referenceDocs)
  if (!view) return null
  const project = projects.find((candidate) => candidate.id === projectId) ?? { id: projectId, name: projectId }
  const tree = buildDocTree(referenceDocs)
  const openIndex = () => openDocs({ docs: 'index' })
  const openHistory = (highlightId) => navigate(`/projects/${projectId}/history`, { state: { highlightId } })

  return (
    <div data-docs-overlay={view.kind} role="dialog" aria-label="Docs" className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">
      <BreadcrumbBar>
        <Breadcrumb
          items={[
            ...projectCrumbs(project),
            // (On the index, Docs is the page you're on; deeper, the way back to it.)
            { label: 'Docs', ...(view.kind !== 'index' && { onClick: openIndex }) },
            ...(view.kind === 'dsUpdates' ? [{ label: 'Document updates' }] : []),
            ...(view.kind === 'doc' ? [...(docPath(tree, view.doc.id) ?? []).map((label) => ({ label })), { label: view.doc.title, key: view.doc.id }] : []),
          ]}
        />
      </BreadcrumbBar>
      <div data-docs-scroll className="min-h-0 flex-1 overflow-y-auto">
        {view.kind === 'doc' && <ReferenceDocView key={view.doc.id} doc={view.doc} />}
        {view.kind === 'dsUpdates' && <DesignSystemUpdates onOpenDoc={openDoc} onOpenHistory={openHistory} />}
        {view.kind === 'index' && <DocsIndex tree={tree} onOpen={openDoc} />}
      </div>
    </div>
  )
}

export default DocsOverlay
