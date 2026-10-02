import { useEffect, useRef, useState } from 'react'
import {
  AppWindow,
  Component,
  FileCode,
  Files,
  GitMerge,
  Layers,
  LayoutGrid,
  PanelBottom,
  ScanEye,
  ScrollText,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { openOrFocusPanel, panelById } from '@/components/dockview/DockLayout'
import { cn } from 'cn'
import CommandModal, { CommandResults, useCommandSearch } from '@/components/layout/CommandModal'
import SearchField from '@/components/layout/SearchField'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'
import { applyLayoutPreset } from '@/components/layout/LayoutMenu'
import { layoutPresets } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Every command the palette offers, by section. Windows open as a tab of
// their window (or focus it) — Preview isn't one: it only opens from a
// pane's `+`; Files / Layers /
// Assets open the navigator pane; Terminal / Console / Conflict Points the
// docked bottom panel.
function useCommands() {
  const { dockApi, setFilesWindow, bottomPanel, setBottomPanel, openMergeStudio } = useWorkspace()
  const showTerminal = () => setBottomPanel({ tab: 'terminal', open: true })

  const windowViews = [
    { def: panelById.editor, label: 'Code Editor', icon: FileCode },
    { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
    { def: panelById.chat, label: 'AI Chat', icon: Sparkles, keywords: 'ask devsign agent assistant' },
  ]
  const navigatorViews = [
    { tab: 'files', label: 'Files', icon: Files, keywords: 'explorer tree' },
    { tab: 'layers', label: 'Layers', icon: Layers },
    { tab: 'assets', label: 'Assets', icon: Component },
    { tab: 'inspect', label: 'Inspect', icon: ScanEye, keywords: 'dev mode design spec css properties' },
  ]
  const bottomViews = [
    { tab: 'terminal', label: 'Terminal', icon: SquareTerminal },
    { tab: 'console', label: 'Console', icon: ScrollText, keywords: 'logs' },
    { tab: 'conflict', label: 'Conflict Points', icon: TriangleAlert, keywords: 'problems diagnostics' },
  ]

  return [
    ...windowViews.map(({ def, label, icon, keywords }) => ({
      id: `open-${def.id}`,
      section: 'Views',
      label,
      hint: 'Tab',
      icon,
      keywords,
      run: () => openOrFocusPanel(dockApi, def),
    })),
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
      id: 'toggle-bottom',
      section: 'Layout',
      label: bottomPanel.open ? 'Collapse bottom panel' : 'Expand bottom panel',
      icon: PanelBottom,
      run: () => setBottomPanel({ open: !bottomPanel.open }),
    },
    ...layoutPresets.filter((preset) => preset.id !== 'split-preview').map((preset) => ({
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

// The header search field, when it's on screen (it steps aside in narrow
// views — see TopBar).
function visibleHeaderSearch() {
  const field = document.querySelector('[data-command-search]')
  return field && field.offsetParent !== null ? field : null
}

// The Workspace's quick command palette (⌘K / Ctrl+K, or the header's
// search field). It's how a view — Files, Terminal, Browser, Canvas, AI
// Chat, … — is opened without hunting for its button; splitting is done by
// dragging a tab (see WorkspaceSplitLayout). With the header search on
// screen, ⌘K just focuses it (HeaderCommandSearch); otherwise it opens the
// CommandModal.
function CommandPalette({ open, onOpenChange }) {
  const commands = useCommands()

  // ⌘K / Ctrl+K from anywhere in the Workspace.
  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const field = visibleHeaderSearch()
        if (field && !open) {
          if (document.activeElement === field) field.blur()
          else field.focus()
          return
        }
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <CommandModal
      open={open}
      onOpenChange={onOpenChange}
      commands={commands}
      title="Command palette"
      placeholder="Open a view or run a command…"
    />
  )
}

// The header search as the palette itself: type straight into the field,
// and only the results drop down under it, edge to edge with it — no
// second input, nothing over the middle of the view. Open while focused.
export function HeaderCommandSearch({ className }) {
  const commands = useCommands()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const search = useCommandSearch(commands, () => inputRef.current?.blur())

  return (
    <SearchField
      ref={inputRef}
      data-command-search=""
      className={className}
      placeholder="Search files, commands..."
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label="Command palette"
      value={search.query}
      onChange={(e) => search.setQuery(e.target.value)}
      onFocus={() => {
        search.setQuery('')
        setOpen(true)
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          inputRef.current?.blur()
          return
        }
        search.onKeyDown(e)
      }}
    >
      {!open && (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10.5px] text-muted-foreground">
          ⌘K
        </kbd>
      )}
      {open && (
        <div className={cn('absolute inset-x-0 top-full mt-1.5 overflow-hidden bg-card animate-in fade-in slide-in-from-top-1 duration-100', PANEL_RADIUS, FLOATING_PANEL)}>
          <CommandResults search={search} />
        </div>
      )}
    </SearchField>
  )
}

export default CommandPalette
