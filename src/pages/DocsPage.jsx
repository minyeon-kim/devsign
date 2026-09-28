import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReferenceDocView, { DOC_TYPES } from '@/components/archive/ReferenceDocView'
import DesignSystemUpdates from '@/components/archive/DesignSystemUpdates'
import { buildDocTree, docPath } from '@/lib/docCategories'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { allPeople } from '@/data/mockData'

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

function Crumb({ children, onClick, current }) {
  if (current) return <span className="min-w-0 truncate text-foreground">{children}</span>
  if (!onClick) return <span className="shrink-0 text-muted-foreground">{children}</span>
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </button>
  )
}

function CrumbSeparator() {
  return <span className="shrink-0 font-normal text-muted-foreground/60">/</span>
}

// Which view to show, from the link that opened it (`location.state`):
// `{ docId }` a doc, `{ tab: 'dsUpdates' }` the Design System Updates
// pipeline, nothing the categorized index.
function resolveView(state, referenceDocs) {
  const doc = state?.docId && referenceDocs.find((d) => d.id === state.docId)
  if (doc) return { kind: 'doc', doc }
  if (state?.tab === 'dsUpdates') return { kind: 'dsUpdates' }
  return { kind: 'index' }
}

// Docs — the project's Reference Docs (its own activity bar icon, with the
// category tree in the drawer) and the Design System Updates pipeline that
// generates new ones. The header is the only place the path is shown:
// Project / Docs / category / … / doc.
function DocsPage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { referenceDocs } = useWorkspace()
  const tree = buildDocTree(referenceDocs)
  const view = resolveView(location.state, referenceDocs)
  const docsPath = `/projects/${project.id}/docs`

  const openDoc = (docId) => navigate(docsPath, { state: { docId } })
  const openIndex = () => navigate(docsPath)
  const openHistory = (highlightId) => navigate(`/projects/${project.id}/history`, { state: { highlightId } })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
          <span className="max-w-[240px] min-w-0 truncate text-muted-foreground">{project.name}</span>
          <CrumbSeparator />
          <Crumb current={view.kind === 'index'} onClick={openIndex}>
            Docs
          </Crumb>
          {view.kind === 'dsUpdates' && (
            <>
              <CrumbSeparator />
              <Crumb current>Design System Updates</Crumb>
            </>
          )}
          {view.kind === 'doc' && (
            <>
              {(docPath(tree, view.doc.id) ?? []).map((label) => (
                <span key={label} className="flex shrink-0 items-center gap-2">
                  <CrumbSeparator />
                  <Crumb>{label}</Crumb>
                </span>
              ))}
              <CrumbSeparator />
              <Crumb current>{view.doc.title}</Crumb>
            </>
          )}
        </div>
      </div>

      {/* Keyed by the navigation so a fresh deep link re-applies its view,
          fading the content in rather than hard-swapping it. */}
      <div
        key={location.key}
        className="min-h-0 flex-1 animate-in overflow-y-auto fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
      >
        {view.kind === 'doc' && <ReferenceDocView doc={view.doc} />}
        {view.kind === 'dsUpdates' && <DesignSystemUpdates onOpenDoc={openDoc} onOpenHistory={openHistory} />}
        {view.kind === 'index' && <DocsIndex tree={tree} onOpen={openDoc} />}
      </div>
    </div>
  )
}

export default DocsPage
