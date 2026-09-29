import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Columns2,
  Component,
  FileCode,
  Files,
  GitMerge,
  Layers,
  LayoutGrid,
  Monitor,
  PanelBottom,
  ScanEye,
  ScrollText,
  Search,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { openOrFocusPanel, openPanelInSplit, panelById } from '@/components/dockview/DockLayout'
import { applyLayoutPreset } from '@/components/layout/LayoutMenu'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { layoutPresets } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Every command the palette offers, by section. Windows open as a tab of
// their window (or focus it) or as a new split pane; Files / Layers /
// Assets open the navigator pane; Terminal / Console / Conflict Points the
// docked bottom panel.
function useCommands() {
  const { dockApi, setFilesWindow, bottomPanel, setBottomPanel, openMergeStudio, inspectorOpen, setInspectorOpen } =
    useWorkspace()
  const showTerminal = () => setBottomPanel({ tab: 'terminal', open: true })

  const windowViews = [
    { def: panelById.editor, label: 'Code Editor', icon: FileCode },
    { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
    { def: panelById.preview, label: 'Browser', icon: Monitor, keywords: 'preview' },
    { def: panelById.chat, label: 'AI Chat', icon: Sparkles, keywords: 'ask devsign agent assistant' },
  ]
  const navigatorViews = [
    { tab: 'files', label: 'Files', icon: Files, keywords: 'explorer tree' },
    { tab: 'layers', label: 'Layers', icon: Layers },
    { tab: 'assets', label: 'Assets', icon: Component },
  ]
  const bottomViews = [
    { tab: 'terminal', label: 'Terminal', icon: SquareTerminal },
    { tab: 'console', label: 'Console', icon: ScrollText, keywords: 'logs' },
    { tab: 'conflict', label: 'Conflict Points', icon: TriangleAlert, keywords: 'problems diagnostics' },
  ]

  return [
    ...windowViews.flatMap(({ def, label, icon, keywords }) => [
      { id: `open-${def.id}`, section: 'Views', label, hint: 'Tab', icon, keywords, run: () => openOrFocusPanel(dockApi, def) },
      { id: `split-${def.id}`, section: 'Views', label: `${label} in split`, hint: 'Split', icon: Columns2, keywords, run: () => openPanelInSplit(dockApi, def) },
    ]),
    ...navigatorViews.map(({ tab, label, icon, keywords }) => ({
      id: `nav-${tab}`,
      section: 'Views',
      label,
      hint: 'Pane',
      icon,
      keywords,
      run: () => setFilesWindow({ open: true, tab }),
    })),
    ...bottomViews.map(({ tab, label, icon, keywords }) => ({
      id: `bottom-${tab}`,
      section: 'Views',
      label,
      hint: 'Bottom panel',
      icon,
      keywords,
      run: () => setBottomPanel({ tab, open: true }),
    })),
    {
      id: 'toggle-inspector',
      section: 'Layout',
      label: inspectorOpen ? 'Hide Inspector' : 'Show Inspector',
      icon: ScanEye,
      keywords: 'inspect properties',
      run: () => setInspectorOpen((v) => !v),
    },
    {
      id: 'toggle-bottom',
      section: 'Layout',
      label: bottomPanel.open ? 'Collapse bottom panel' : 'Expand bottom panel',
      icon: PanelBottom,
      run: () => setBottomPanel({ open: !bottomPanel.open }),
    },
    ...layoutPresets.map((preset) => ({
      id: `layout-${preset.id}`,
      section: 'Layout',
      label: `Layout: ${preset.label}`,
      icon: LayoutGrid,
      keywords: preset.description,
      run: () => applyLayoutPreset(dockApi, preset.id, { showTerminal }),
    })),
    { id: 'merge-studio', section: 'Go to', label: 'Merge Studio', icon: GitMerge, run: openMergeStudio },
  ]
}

// The Workspace's quick command palette (⌘K / Ctrl+K, or the header's
// search field): type to filter, ↑ ↓ to move, Enter to run. No backdrop —
// it opens over the workspace without dimming or blocking it.
// It's how a view — Files, Terminal, Browser, Canvas, … — is opened as a
// tab, a split pane or in the bottom panel without hunting for its button.
function CommandPalette({ open, onOpenChange }) {
  const commands = useCommands()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef(null)

  // Every opening starts fresh, however it was opened (⌘K, the header).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }

  // ⌘K / Ctrl+K toggles it from anywhere in the Workspace.
  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.section}`.toLowerCase().includes(q))
  }, [commands, query])

  function run(command) {
    onOpenChange(false)
    command.run()
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length)
      setActiveIndex(next)
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      run(results[activeIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        overlay={false}
        showCloseButton={false}
        className={cn('top-[18%] translate-y-0 gap-0 overflow-hidden bg-card p-0 ring-0 sm:max-w-[560px]', PANEL_RADIUS, FLOATING_PANEL)}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4">
          <Search className="size-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Open a view or run a command…"
            aria-label="Command"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10.5px] text-slate-400">esc</kbd>
        </div>

        <div ref={listRef} role="listbox" aria-label="Commands" className="max-h-[360px] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">No matching commands.</p>}
          {results.map((command, i) => {
            const Icon = command.icon
            const newSection = i === 0 || results[i - 1].section !== command.section
            return (
              <div key={command.id}>
                {newSection && (
                  <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">{command.section}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  data-index={i}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors',
                    i === activeIndex ? 'bg-white/[0.07] text-white' : 'text-slate-300'
                  )}
                >
                  <Icon className="size-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="shrink-0 text-[11px] text-slate-500">{command.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CommandPalette
