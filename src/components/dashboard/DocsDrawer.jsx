import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, FileText, Folder, FolderOpen, Library, Palette, Search, X } from 'lucide-react'
import { cn } from 'cn'
import { buildDocTree, countDocs, docPath, searchDocs } from '@/lib/docCategories'
import { useWorkspace } from '@/state/WorkspaceProvider'

const activeClass = 'bg-muted text-foreground'
// Each tree level indents by one step, with a hairline guide down the
// left of its children so the parent → child structure reads at a glance.
const GUIDE = 'ml-[15px] border-l border-white/[0.06] pl-1.5'

// The docs route keeps its view in `location.state` (one URL); a Link to
// the same URL replaces the history entry by default — `replace={false}`
// makes each pick a real step for the header's ‹ › buttons.
function DocLink({ doc, docsPath, active }) {
  return (
    <Link
      to={docsPath}
      state={{ docId: doc.id }}
      replace={false}
      aria-current={active ? 'page' : undefined}
      title={doc.title}
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && activeClass
      )}
    >
      <FileText className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{doc.title}</span>
    </Link>
  )
}

// A category (or sub-category): a header row that expands / collapses its
// contents in place, then its docs and sub-categories one level in.
function Category({ node, depth, open, onToggle, docsPath, activeDocId }) {
  const expanded = open.has(node.id)
  const FolderIcon = expanded ? FolderOpen : Folder

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        aria-expanded={expanded}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg pr-2 pl-1 text-left transition-colors hover:bg-muted',
          depth === 0 ? 'text-[12px] font-semibold tracking-wide text-slate-300 uppercase' : 'text-[12.5px] font-medium text-slate-300'
        )}
      >
        <ChevronRight
          className={cn('size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-90')}
        />
        {depth > 0 && <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        <span className="shrink-0 text-[11px] font-normal tracking-normal text-muted-foreground/60 normal-case tabular-nums">{countDocs(node)}</span>
      </button>
      {expanded && (
        <div className={cn(GUIDE, 'mt-0.5 mb-1 flex flex-col gap-0.5')}>
          {node.children.map((child) => (
            <Category
              key={child.id}
              node={child}
              depth={depth + 1}
              open={open}
              onToggle={onToggle}
              docsPath={docsPath}
              activeDocId={activeDocId}
            />
          ))}
          {node.docs.map((doc) => (
            <DocLink key={doc.id} doc={doc} docsPath={docsPath} active={doc.id === activeDocId} />
          ))}
        </div>
      )}
    </div>
  )
}

// The drawer behind the activity bar's Docs icon: the project's Reference
// Docs as a category tree — Guidelines (Brand, Foundations), Component
// specs (incl. the docs Design System Updates generate), Engineering,
// Process — with the Design System Updates pipeline linked at the top.
// Categories on the path to the open doc start expanded.
function DocsDrawer({ project }) {
  const location = useLocation()
  const { referenceDocs, dsUpdates } = useWorkspace()
  const docsPath = `/projects/${project.id}/docs`
  const onDocs = location.pathname.startsWith(docsPath)
  const state = onDocs ? (location.state ?? {}) : {}
  const activeDocId = state.docId
  const [query, setQuery] = useState('')
  const tree = buildDocTree(referenceDocs)
  const matches = searchDocs(referenceDocs, query)
  const visibleTree = query.trim() ? buildDocTree(matches) : tree

  const idsOnPath = (docId) => {
    const labels = docPath(tree, docId) ?? []
    const ids = []
    ;(function walk(nodes) {
      for (const n of nodes) {
        if (labels.includes(n.label)) {
          ids.push(n.id)
          walk(n.children)
        }
      }
    })(tree)
    return ids
  }

  const [open, setOpen] = useState(() => new Set(activeDocId ? idsOnPath(activeDocId) : tree.map((n) => n.id)))
  // Opening a doc from elsewhere reveals it in the tree.
  const [seenDoc, setSeenDoc] = useState(activeDocId)
  if (activeDocId !== seenDoc) {
    setSeenDoc(activeDocId)
    if (activeDocId) setOpen((prev) => new Set([...prev, ...idsOnPath(activeDocId)]))
  }

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleOpen = new Set(open)
  if (query.trim()) {
    const expand = (nodes) => nodes.forEach((node) => { visibleOpen.add(node.id); expand(node.children) })
    expand(visibleTree)
  }

  const rowClass =
    'flex h-9 min-w-0 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <nav aria-label="Docs" className="flex flex-col gap-0.5 pb-2">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search project docs"
          placeholder="Search docs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}
          className="h-8 w-full min-w-0 appearance-none rounded-full border border-white/10 bg-[#09090A] pr-8 pl-8 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && <button type="button" aria-label="Clear docs search" onClick={() => setQuery('')} className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
      </div>
      <Link
        to={docsPath}
        replace={false}
        aria-current={onDocs && !activeDocId && state.tab !== 'dsUpdates' ? 'page' : undefined}
        className={cn(rowClass, onDocs && !activeDocId && state.tab !== 'dsUpdates' && activeClass)}
      >
        <Library className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">All docs</span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums">{referenceDocs.length}</span>
      </Link>
      <Link
        to={docsPath}
        state={{ tab: 'dsUpdates' }}
        replace={false}
        aria-current={state.tab === 'dsUpdates' ? 'page' : undefined}
        className={cn(rowClass, 'mb-2', state.tab === 'dsUpdates' && activeClass)}
      >
        <Palette className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Design System Updates</span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums">
          {dsUpdates.filter((u) => u.stage !== 'archived').length || ''}
        </span>
      </Link>

      {query.trim() && <p role="status" className="px-2 py-1 text-[11px] text-muted-foreground">{matches.length ? `${matches.length} docs found` : 'No matching docs'}</p>}
      {visibleTree.map((node) => (
        <Category key={node.id} node={node} depth={0} open={visibleOpen} onToggle={toggle} docsPath={docsPath} activeDocId={activeDocId} />
      ))}
    </nav>
  )
}

export default DocsDrawer
