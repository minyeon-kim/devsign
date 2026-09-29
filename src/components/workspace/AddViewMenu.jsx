import { useState } from 'react'
import {
  AppWindow,
  Component,
  FileCode,
  Files,
  Layers,
  LayoutGrid,
  Monitor,
  Plus,
  ScrollText,
  Sparkles,
  SquareTerminal,
} from 'lucide-react'
import { addDockPanel, panelById } from '@/components/dockview/DockLayout'
import CommandModal from '@/components/layout/CommandModal'
import { applyLayoutPreset } from '@/components/layout/LayoutMenu'
import { layoutPresets } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Views that open as windows, and the navigator's (Files / Layers /
// Assets), which open its pane at the left instead.
const WINDOW_VIEWS = [
  { def: panelById.editor, label: 'Code Editor', icon: FileCode },
  { def: panelById.canvas, label: 'Canvas', icon: AppWindow },
  { def: panelById.preview, label: 'Browser', icon: Monitor, keywords: 'preview' },
  { def: panelById.chat, label: 'AI Chat', icon: Sparkles, keywords: 'ask devsign agent assistant' },
  { def: panelById.terminal, label: 'Terminal', icon: SquareTerminal },
  { def: panelById.console, label: 'Console', icon: ScrollText, keywords: 'logs' },
]
const NAVIGATOR_VIEWS = [
  { tab: 'files', label: 'Files', icon: Files, keywords: 'explorer tree' },
  { tab: 'layers', label: 'Layers', icon: Layers },
  { tab: 'assets', label: 'Assets', icon: Component },
]

// Opens `def` as a tab of window `group` — or brings it forward if it's
// already here. A view open elsewhere moves here (a panel lives in one
// window at a time).
function openHere(dockApi, group, def) {
  const existing = dockApi.getPanel(def.id)
  if (existing?.group?.id === group.id) {
    existing.api.setActive()
    return
  }
  existing?.api.close()
  addDockPanel(dockApi, def, { position: { referenceGroup: group.id } })
}

// The `+` in a window's header (Cursor style): a centered command modal to
// open another view — Code Editor, Canvas, Browser, AI Chat, Terminal, … —
// as a tab of this window, bring up the navigator, or apply a split layout.
// Splitting a view off into its own pane is done by dragging its tab.
function AddViewMenu({ group, dockApi }) {
  const { setFilesWindow, setBottomPanel } = useWorkspace()
  const [open, setOpen] = useState(false)
  const here = new Set(group.panelIds)

  const commands = [
    ...WINDOW_VIEWS.map(({ def, label, icon, keywords }) => ({
      id: `view-${def.id}`,
      section: 'Open in this pane',
      label,
      hint: here.has(def.id) ? 'Open' : dockApi.getPanel(def.id) ? 'Move here' : undefined,
      icon,
      keywords,
      run: () => openHere(dockApi, group, def),
    })),
    ...NAVIGATOR_VIEWS.map(({ tab, label, icon, keywords }) => ({
      id: `nav-${tab}`,
      section: 'Navigator',
      label,
      hint: 'Sidebar',
      icon,
      keywords,
      run: () => setFilesWindow({ open: true, tab }),
    })),
    ...layoutPresets.map((preset) => ({
      id: `layout-${preset.id}`,
      section: 'Split layouts',
      label: preset.label,
      icon: LayoutGrid,
      keywords: preset.description,
      run: () => applyLayoutPreset(dockApi, preset.id, { showTerminal: () => setBottomPanel({ tab: 'terminal', open: true }) }),
    })),
  ]

  return (
    <>
      <button
        type="button"
        title="Open a view"
        aria-label="Open a view"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex size-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <Plus className="size-3.5" />
      </button>
      <CommandModal
        open={open}
        onOpenChange={setOpen}
        commands={commands}
        title="Open a view"
        placeholder="Open a view in this pane…"
      />
    </>
  )
}

export default AddViewMenu
