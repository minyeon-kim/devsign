import { buildFileTree } from '@/lib/fileTree'
import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Frame, Upload } from 'lucide-react'
import { cn } from 'cn'
import { toast } from '@/i18n/toast'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { assetIcon, getFileIconMeta } from '@/lib/fileIcons'
import { IMPORT_ACCEPT } from '@/lib/importFiles'
import { useWorkspace } from '@/state/WorkspaceProvider'

function announce({ code, design }) {
  const parts = [code && `${code} code file${code === 1 ? '' : 's'} added to Files`, design && `${design} design file${design === 1 ? '' : 's'} added to Assets`]
  toast('Imported', { description: parts.filter(Boolean).join(' · ') || 'Nothing to import.' })
}

// The Import action at the top of the file tree: upload Figma (.fig),
// Illustrator (.ai) / SVG / image files or code files, or link a Figma
// file by URL. Code files join the tree and open in the editor; design
// files become Assets (the canvas's Layers drawer → Assets tab).
function ImportMenu() {
  const { importFiles, importFigmaLink } = useWorkspace()
  const inputRef = useRef(null)
  const [figmaUrl, setFigmaUrl] = useState('')

  async function handleFiles(event) {
    const list = event.target.files
    if (!list?.length) return
    announce(await importFiles(list))
    event.target.value = ''
  }

  function linkFigma(event) {
    event.preventDefault()
    const url = figmaUrl.trim()
    if (!url) return
    const name = importFigmaLink(url)
    toast('Figma file linked', { description: `“${name}” added to Assets` })
    setFigmaUrl('')
  }

  return (
    <Popover>
      <PopoverTrigger
        title="Import files"
        className="ml-auto flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground data-[popup-open]:bg-white/[0.06] data-[popup-open]:text-foreground"
      >
        <Upload className="size-3" />
        Import
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 gap-3 rounded-2xl p-3 font-sans">
        <p className="text-sm font-semibold text-foreground">Import into this project</p>

        <PopoverClose
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-start gap-3 rounded-xl bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.07]"
        >
          <Upload className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span>
            <span className="block text-xs font-medium text-foreground">Upload files</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              Figma (.fig), Illustrator (.ai), SVG and images, or code files (.jsx, .tsx, .css, .json…). You can also drop them onto the file tree.
            </span>
          </span>
        </PopoverClose>

        <form onSubmit={linkFigma} className="flex flex-col gap-1.5">
          <label htmlFor="figma-url" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Frame className="size-3.5" />
            Link a Figma file
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="figma-url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/design/…"
              className="h-8 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
            />
            <button
              type="submit"
              disabled={!figmaUrl.trim()}
              className="h-8 shrink-0 rounded-full bg-emerald-400 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:bg-white/[0.06] disabled:text-muted-foreground"
            >
              Link
            </button>
          </div>
        </form>
      </PopoverContent>
      <input ref={inputRef} type="file" multiple accept={IMPORT_ACCEPT} onChange={handleFiles} className="hidden" />
    </Popover>
  )
}

function ExplorerPanel() {
  const { workspaceFiles, activeFileId, setActiveFileId, getFileName, renameFile, importedAssets, importFiles } = useWorkspace()
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const tree = buildFileTree(workspaceFiles, (file) => getFileName(file.id))

  function startRename(file) {
    setRenamingId(file.id)
    setDraftName(getFileName(file.id))
  }

  function commitRename(fileId) {
    renameFile(fileId, draftName)
    setRenamingId(null)
  }

  async function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) announce(await importFiles(event.dataTransfer.files))
  }

  function renderNodes(nodes, depth = 0) {
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        const expanded = !collapsed.has(node.path)
        const Icon = expanded ? FolderOpen : Folder
        const Chevron = expanded ? ChevronDown : ChevronRight
        return (
          <div key={node.path} role="treeitem" aria-label={node.name} aria-expanded={expanded} aria-level={depth + 1}>
            <button type="button" onClick={() => setCollapsed((prev) => {
              const next = new Set(prev)
              if (next.has(node.path)) next.delete(node.path)
              else next.add(node.path)
              return next
            })} style={{ paddingLeft: depth * 16 }} className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left hover:bg-muted hover:text-foreground">
              <Chevron className="size-3 shrink-0" />
              <Icon className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{node.name}</span>
            </button>
            {expanded && <div role="group">{renderNodes(node.children, depth + 1)}</div>}
          </div>
        )
      }
      const { file, name } = node
      const { Icon, colorClass } = getFileIconMeta(name)
      const active = activeFileId === file.id
      const isRenaming = renamingId === file.id

      if (isRenaming) {
        return (
          <div key={file.id} role="treeitem" aria-level={depth + 1} aria-selected={active} style={{ paddingLeft: 12 + depth * 16 }} className="flex w-full items-center gap-1.5 py-1 pr-2">
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
          style={{ paddingLeft: 12 + depth * 16 }}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left transition-colors hover:bg-muted hover:text-foreground',
            active && 'bg-[#0E1F1B] text-[#D1FAE5]'
          )}
        >
          <Icon className={cn('size-3.5 shrink-0', !active && colorClass)} />
          <span className="truncate">{name}</span>
          {file.imported && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Imported" />}
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
      {/* Folders below are derived from the project's paths, starting at root. */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/60 pr-1.5 pl-3 text-xs font-medium text-foreground/70">
        <Folder className="size-3.5" />
        <span title="Project root">/</span>
        <ImportMenu />
      </div>
      <div className="scroll-fade-bottom flex-1 overflow-auto p-2.5 text-xs text-muted-foreground">
        <div role="tree" aria-label="Project files">{renderNodes(tree)}</div>
        {!tree.length && <p className="px-2 py-4">No files yet. Import files to get started.</p>}

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
