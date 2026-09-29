import { useEffect } from 'react'
import {
  AppWindow,
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
  Sparkles,
  SquareTerminal,
  TriangleAlert,
} from 'lucide-react'
import { openOrFocusPanel, panelById } from '@/components/dockview/DockLayout'
import CommandModal from '@/components/layout/CommandModal'
import { applyLayoutPreset } from '@/components/layout/LayoutMenu'
import { layoutPresets } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Every command the palette offers, by section. Windows open as a tab of
// their window (or focus it); Files / Layers /
// Assets open the navigator pane; Terminal / Console / Conflict Points the
// docked bottom panel.
function useCommands() {
  const { dockApi, setFilesWindow, bottomPanel, setBottomPanel, openMergeStudio, inspectorOpen, setInspectorOpen } =
    useWorkspace()
  const showTerminal = () => setBottomPanel({ tab: 'terminal', open: true })

  const windowViews = [
    { def: panelById.editor, label: 'Code Editor', icon: FileCode },
    { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
    { def: panelById.preview, label: 'Preview', icon: Monitor, keywords: 'preview browser' },
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
// search field) — a CommandModal over the commands above. It's how a view —
// Files, Terminal, Browser, Canvas, AI Chat, … — is opened without hunting
// for its button; splitting is done by dragging a tab (see
// WorkspaceSplitLayout).
function CommandPalette({ open, onOpenChange }) {
  const commands = useCommands()

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

export default CommandPalette
