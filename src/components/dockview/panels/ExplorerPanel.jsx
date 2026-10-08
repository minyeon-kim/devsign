import { buildFileTree } from '@/lib/fileTree'
import { useState } from 'react'
import { FilePlus, Folder, FolderOpen, FolderPlus, RefreshCw, Upload } from 'lucide-react'
import { cn } from 'cn'
import { toast } from '@/i18n/toast'
import { assetIcon, getFileIconMeta } from '@/lib/fileIcons'
import { projects } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function announce({ code, design }) {
  const parts = [code && `${code} code file${code === 1 ? '' : 's'} added to Files`, design && `${design} design file${design === 1 ? '' : 's'} added to Assets`]
  toast('Imported', { description: parts.filter(Boolean).join(' · ') || 'Nothing to import.' })
}

// A hover-revealed row action (New File, New Folder, Refresh) — hidden
// until the row it sits in is hovered (see the `group/row` wrapper below).
// No button chrome (no circle, no fill): only the icon itself lightens on
// hover, Cursor-style, with a small tooltip below it naming the action.
function RowAction({ icon: Icon, label, spin, onClick }) {
  return (
    <span className="group/tip relative flex">
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        className="flex items-center justify-center p-0.5 text-slate-500 hover:text-foreground"
      >
        <Icon className={cn('size-3.5', spin && 'animate-spin')} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+5px)] left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--ds-border-subtle)] bg-popover px-2 py-1 text-[11px] text-[#FAFAFA] opacity-0 shadow-lg transition-opacity duration-75 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

function ExplorerPanel() {
  const { projectId, workspaceFiles, emptyFolders, activeFileId, setActiveFileId, getFileName, renameFile, createFile, createFolder, importedAssets, importFiles, draftChanges, editorDirtyFiles } = useWorkspace()
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  // The inline "New File" / "New Folder" row being typed into: which
  // folder it'll land in (root is '') and which kind it'll create.
  const [creating, setCreating] = useState(null)
  const [creatingName, setCreatingName] = useState('')
  const [spinning, setSpinning] = useState(false)
  const rootName = projects.find((p) => p.id === projectId)?.name ?? projectId
  // The project's own root folder, shown as the tree's own top node —
  // not a separate path bar — so it can collapse like any other folder.
  const tree = [{ kind: 'folder', path: '', name: rootName, children: buildFileTree(workspaceFiles, (file) => getFileName(file.id), emptyFolders) }]

  function startRename(file) {
    setRenamingId(file.id)
    setDraftName(getFileName(file.id))
  }

  function commitRename(fileId) {
    renameFile(fileId, draftName)
    setRenamingId(null)
  }

  function startCreating(parentPath, kind) {
    setCollapsed((prev) => {
      if (!prev.has(parentPath)) return prev
      const next = new Set(prev)
      next.delete(parentPath)
      return next
    })
    setCreating({ parentPath, kind })
    setCreatingName('')
  }

  function commitCreating() {
    const name = creatingName.trim()
    if (name) {
      if (creating.kind === 'folder') createFolder(creating.parentPath, name)
      else createFile(creating.parentPath, name)
    }
    setCreating(null)
    setCreatingName('')
  }

  function cancelCreating() {
    setCreating(null)
    setCreatingName('')
  }

  function refreshExplorer() {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 500)
  }

  async function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) announce(await importFiles(event.dataTransfer.files))
  }

  function renderCreatingRow(depth) {
    const { Icon, colorClass } = creating.kind === 'folder' ? { Icon: Folder, colorClass: 'text-slate-400' } : getFileIconMeta(creatingName || 'untitled')
    return (
      <div role="treeitem" style={{ paddingLeft: 6 + depth * 10 }} className="flex w-full items-center gap-1.5 py-1 pr-2">
        <Icon className={cn('size-3.5 shrink-0', colorClass)} />
        <input
          autoFocus
          value={creatingName}
          onChange={(e) => setCreatingName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitCreating}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCreating()
            if (e.key === 'Escape') cancelCreating()
          }}
          placeholder={creating.kind === 'folder' ? 'Folder name' : 'File name'}
          className="w-full truncate rounded-sm bg-transparent px-1 text-xs text-foreground outline-none ring-1 ring-emerald-400/60 placeholder:text-muted-foreground"
        />
      </div>
    )
  }

  function renderNodes(nodes, depth = 0) {
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        const expanded = !collapsed.has(node.path)
        const Icon = expanded ? FolderOpen : Folder
        const isRoot = depth === 0
        return (
          <div key={node.path} role="treeitem" aria-label={node.name} aria-expanded={expanded} aria-level={depth + 1}>
            <div className="group/row flex items-center rounded-lg hover:bg-muted hover:text-foreground">
              <button type="button" onClick={() => setCollapsed((prev) => {
                const next = new Set(prev)
                if (next.has(node.path)) next.delete(node.path)
                else next.add(node.path)
                return next
              })} style={{ paddingLeft: 6 + depth * 10 }} className="flex h-full min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left">
                <Icon className="size-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{node.name}</span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5 pr-1.5 pointer-events-none opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">
                {isRoot && <RowAction icon={RefreshCw} label="Refresh Explorer" spin={spinning} onClick={refreshExplorer} />}
                <RowAction icon={FilePlus} label="New File..." onClick={() => startCreating(node.path, 'file')} />
                <RowAction icon={FolderPlus} label="New Folder..." onClick={() => startCreating(node.path, 'folder')} />
              </div>
            </div>
            {expanded && (
              <div role="group">
                {creating?.parentPath === node.path && renderCreatingRow(depth + 1)}
                {renderNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        )
      }
      const { file, name } = node
      const { Icon, colorClass } = getFileIconMeta(name)
      const active = activeFileId === file.id
      const isRenaming = renamingId === file.id

      if (isRenaming) {
        return (
          <div key={file.id} role="treeitem" aria-level={depth + 1} aria-selected={active} style={{ paddingLeft: 6 + depth * 10 }} className="flex w-full items-center gap-1.5 py-1 pr-2">
            <Icon className={cn('size-3.5 shrink-0', colorClass)} />
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(file.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(file.id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className="w-full truncate rounded-sm bg-transparent px-1 text-xs text-foreground outline-none ring-1 ring-emerald-400/60"
            />
          </div>
        )
      }

      return (
        <button
          key={file.id} role="treeitem" aria-level={depth + 1} aria-selected={active}
          type="button"
          onClick={() => setActiveFileId(file.id)}
          onDoubleClick={() => startRename(file)}
          title={`${node.path}${file.imported ? ' · imported' : ''} · Double-click to rename`}
          style={{ paddingLeft: 6 + depth * 10 }}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-lg py-1 pr-2 text-left transition-colors hover:bg-muted hover:text-foreground',
            active && 'bg-[var(--ds-selected-bg)] text-[#D1FAE5]'
          )}
        >
          <Icon className={cn('size-3.5 shrink-0', !active && colorClass)} />
          <span className="truncate">{name}</span>
          {(draftChanges[file.id] || editorDirtyFiles[file.id]) && <span className="ds-status-dot bg-[#5EEAB5]" role="img" aria-label="Uncommitted or unsaved changes" />}
          {file.imported && <span className="ds-status-dot ml-auto bg-emerald-400" aria-label="Imported" />}
        </button>
      )
    })
  }

  return (
    <div
      className="relative flex h-full flex-col bg-card"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <div className="scroll-fade-bottom flex-1 overflow-auto p-2.5 text-xs text-muted-foreground">
        <div role="tree" aria-label="Project files">{renderNodes(tree)}</div>
        {!tree[0].children.length && <p className="px-2 py-4">No files yet. Import files to get started.</p>}

        {importedAssets.length > 0 && (
          <div className="mt-3">
            <p className="px-2 pb-1 font-sans text-[11px] font-medium text-slate-500">Design imports</p>
            {importedAssets.map((asset) => {
              const Icon = assetIcon(asset.kind)
              return (
                <div key={asset.id} title={asset.url ?? asset.name} className="flex items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-6">
                  <Icon className="size-3.5 shrink-0 text-violet-300" />
                  <span className="truncate">{asset.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-1.5 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-400/60 bg-emerald-400/[0.06] font-sans text-xs text-emerald-200">
          <Upload className="size-4" />
          Drop to import
        </div>
      )}
    </div>
  )
}

export default ExplorerPanel
