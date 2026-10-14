import { Component, Files, Layers, ScanEye, X } from 'lucide-react'
import { cn } from 'cn'
import NavigatorPanel from '@/components/dockview/panels/NavigatorPanel'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { inCanvasViewOf } from '@/lib/panelPrefs'
import { PANE_MOTION } from '@/lib/useAfterPaint'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Files · Layers · Assets · Inspect, in the main window: a column of icons
// floating over the canvas's left, under the Preview · Screens · Code tabs —
// the canvas runs under it to the window's edge. An icon opens its view in a
// panel floating beside the column (or the preview, or the code) — another
// icon swaps it, the same icon (or ×) puts it away. It's the side panel's own state (`sidePanel.open`, the
// navigator's tab), so ⌘B and anything that asks for a view still work;
// only Terminal and Console still open in the side panel itself.
const VIEWS = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: Component },
  { id: 'inspect', label: 'Inspect', icon: ScanEye },
]
export const CANVAS_VIEW_WIDTH = 280

export function CanvasViewRail() {
  const { sidePanel, filesWindow, toggleSideView } = useWorkspace()
  const language = useLanguage()
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  return (
    // (A pill floating over the canvas's left, under the top bar's row of tools.)
    <div data-canvas-view-rail role="toolbar" aria-orientation="vertical" aria-label={translateText('Workspace views', language)} className="absolute top-14 left-2 z-40 flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.08] bg-card/95 p-1 shadow-lg shadow-black/40 backdrop-blur-sm">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          data-canvas-view={id}
          aria-pressed={open === id}
          aria-controls="canvas-view-panel"
          title={translateText(label, language)}
          aria-label={translateText(label, language)}
          onClick={() => toggleSideView(id)}
          className={cn('ds-intrinsic flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
            open === id ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100')}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}

// The view, opened beside the column: over the canvas's left, its width easing in and out.
export function CanvasViewPanel() {
  const { sidePanel, filesWindow, setSidePanel } = useWorkspace()
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  const title = VIEWS.find((view) => view.id === open)?.label
  return (
    <div
      id="canvas-view-panel"
      data-canvas-view-panel={open ?? undefined}
      inert={!open || undefined}
      aria-hidden={!open || undefined}
      style={{ width: open ? CANVAS_VIEW_WIDTH : 0 }}
      className={cn('absolute inset-y-2 left-14 z-30 overflow-hidden rounded-xl transition-[width,opacity] motion-reduce:transition-none', PANE_MOTION,
        open ? 'border border-white/[0.08] bg-card opacity-100 shadow-2xl shadow-black/50' : 'opacity-0')}
    >
      {/* (At its full width whatever it's opened to, so nothing re-wraps while it eases.) */}
      <div className="flex h-full flex-col" style={{ width: CANVAS_VIEW_WIDTH }}>
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] pr-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-100">{title && <LocalizedText text={title} />}</span>
          <button type="button" data-canvas-view-close aria-label="Close" title="Close" onClick={() => setSidePanel({ open: false })}
            className="ds-intrinsic flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
            <X className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{open && <NavigatorPanel inCanvas />}</div>
      </div>
    </div>
  )
}
