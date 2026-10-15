import { Fragment, useEffect, useRef, useState } from 'react'
import { Component, Files, Layers, ScanEye, X } from 'lucide-react'
import SplitHandle from '@/components/layout/SplitHandle'
import { cn } from 'cn'
import NavigatorPanel from '@/components/dockview/panels/NavigatorPanel'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { RIGHT_PANEL, TOOL_PANEL, foldForRoom, inCanvasViewOf } from '@/lib/panelPrefs'
import { useAfterPaint } from '@/lib/useAfterPaint'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Files · Layers · Assets · Inspect, in the main window: a row of icons in its tab row, right after the
// Preview · Screens · Code tabs (a rule before them, and one before Inspect) — nothing floats over the
// canvas. An icon opens its view in a tool panel docked at the work area's left, under the tab row, in the same
// row as the canvas (or the preview, or the code, or the comparison): the panel takes its own width and the
// canvas gets what's left. Another icon swaps the view (the panel stays as wide), the same icon (or ×, or
// ⌘\) puts it away. It's the side panel's own state (`sidePanel.open`, the navigator's tab), so ⌘B and
// anything that asks for a view still work; only Terminal and Console still open in the side panel itself.
const VIEWS = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: Component },
  { id: 'inspect', label: 'Inspect', icon: ScanEye, rule: true },
]
const RULE = 'mx-1.5 h-4 w-px shrink-0 bg-white/10'

export function CanvasViewRail() {
  const { sidePanel, filesWindow, toggleSideView, workspaceView, activeView } = useWorkspace()
  const language = useLanguage()
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  // (Code: its files. Screens: the canvas's layers, assets and properties. Preview: all four.)
  const view = activeView === 'mergeStudio' ? null : workspaceView
  const shown = view === 'code' ? VIEWS.filter((entry) => entry.id === 'files') : view === 'screens' ? VIEWS.filter((entry) => entry.id !== 'files') : VIEWS
  return (
    // (In the tab row: 28px buttons, 2px apart — transparent, faint; white 6% under the pointer; the open
    // one on surface-2 in the plain text colour.)
    <div data-canvas-view-rail role="toolbar" aria-orientation="horizontal" aria-label={translateText('Workspace views', language)} onPointerDown={(event) => event.stopPropagation()} className="flex shrink-0 items-center gap-0.5">
      <span aria-hidden className={RULE} />
      {shown.map(({ id, label, icon: Icon, rule }) => (
        <Fragment key={id}>
          {rule && <span aria-hidden className={RULE} />}
          <button
            type="button"
            data-canvas-view={id}
            aria-pressed={open === id}
            aria-controls="canvas-view-panel"
            title={translateText(label, language)}
            aria-label={translateText(label, language)}
            onClick={() => toggleSideView(id)}
            className={cn('ds-intrinsic flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
              open === id ? 'bg-[var(--ds-surface-2)] text-slate-100' : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200')}
          >
            <Icon className="size-4" />
          </button>
        </Fragment>
      ))}
    </div>
  )
}

// How the panels ease in and out: 200ms, ease-out. (No motion at all for a reader who asked for none.)
export const DOCK_MOTION = 'duration-200 ease-out motion-reduce:transition-none'

// The tool panel: a flex child before the canvas in the main window's row (FloatingWindow's `viewDock`),
// as wide as the person left it (260px to start, 200–400 by its right edge), no card — a hairline at its
// right edge, white at 6%. Its width eases (the canvas follows it, keeping its place — CanvasPanel); its
// content stays at the full width, so nothing re-wraps while it moves.
// The canvas (or the comparison) keeps at least MIN_CANVAS: with less than that, this panel folds first,
// then AI Chat at the right (the app sidebar stays).
// What has the right panel's place: the board's change list (not while Merge is up), else Merge's panel.
const dockShownOf = ({ boardShown, activeView, designComparePanelOpen }) => (activeView !== 'mergeStudio' && boardShown) || (designComparePanelOpen ? 'merge' : false)

export function CanvasViewPanel() {
  const { sidePanel, filesWindow, setSidePanel, toolPanelWidth, setToolPanelWidth, aiChat, setAiChat, boardDockShown: boardShown, setBoardConflicts, activeView, designComparePanelOpen, setDesignComparePanelOpen, rightPanelWidth } = useWorkspace()
  // (The board's list is the Screens view's: while Merge is up it's out of the row. Merge's panel takes the place too.)
  const boardDockShown = dockShownOf({ boardShown, activeView, designComparePanelOpen })
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  // (The view it showed stays while it eases shut.)
  const [last, setLast] = useState(open)
  if (open && open !== last) setLast(open)
  const view = open ?? last
  const title = VIEWS.find((entry) => entry.id === view)?.label
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef(toolPanelWidth)
  const target = open ? toolPanelWidth : 0
  const eased = useAfterPaint(target)
  const width = resizing ? target : eased

  const ref = useRef(null)
  const toolOpen = Boolean(open)
  const chatOpen = aiChat.open
  const rightWidth = boardDockShown ? rightPanelWidth : 0
  useEffect(() => {
    const row = ref.current?.parentElement
    if (!row) return undefined
    const check = () => {
      if (!row.clientWidth) return
      const fold = foldForRoom({ room: row.clientWidth, tool: { open: toolOpen, width: toolPanelWidth }, right: { open: rightWidth > 0, width: rightWidth }, chat: chatOpen })
      if (fold === 'tool') setSidePanel({ open: false })
      else if (fold === 'right') { if (boardShown) setBoardConflicts({ open: false, conflictId: null }); else setDesignComparePanelOpen(false) }
      else if (fold === 'chat') setAiChat({ open: false })
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(row)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolOpen, chatOpen, toolPanelWidth, rightWidth])

  return (
    <div
      ref={ref}
      id="canvas-view-panel"
      data-canvas-view-panel={open ?? undefined}
      inert={!open || undefined}
      aria-hidden={!open || undefined}
      style={{ width }}
      className={cn('relative h-full shrink-0 overflow-hidden transition-[width]', DOCK_MOTION, resizing && 'transition-none')}
    >
      <div className="flex h-full flex-col border-r border-white/[0.06] bg-card" style={{ width: toolPanelWidth }}>
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] pr-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-100">{title && <LocalizedText text={title} />}</span>
          <button type="button" data-canvas-view-close aria-label="Close" title="Close · Ctrl+\" onClick={() => setSidePanel({ open: false })}
            className="ds-intrinsic flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
            <X className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{view && <NavigatorPanel inCanvas />}</div>
      </div>
      {open && (
        <SplitHandle
          label="Resize tool panel"
          value={Math.round(((toolPanelWidth - TOOL_PANEL.min) / (TOOL_PANEL.max - TOOL_PANEL.min)) * 100)}
          className="absolute inset-y-0 right-0 z-10"
          onResizeStart={() => { dragStart.current = toolPanelWidth; setResizing(true) }}
          onResize={(dx) => setToolPanelWidth(dragStart.current + dx)}
          onResizeEnd={() => setResizing(false)}
          onStep={(d) => setToolPanelWidth(toolPanelWidth + d)}
          onReset={() => setToolPanelWidth(TOOL_PANEL.width)}
        />
      )}
    </div>
  )
}

// The Screens board's change list, at the right of the work area (the "right panel"): a flex child after the
// canvas (or the comparison) in the same row, its width easing like the tool panel's. BoardConflicts renders
// into it (a portal, from the board — which keeps its data and its camera); this is only its place.
export function BoardDockSlot() {
  const { boardDockShown: boardShown, setBoardDockHost, activeView, designComparePanelOpen, rightPanelWidth, setRightPanelWidth } = useWorkspace()
  // (The board's list is the Screens view's: while Merge is up it's out of the row — kept, and back with the view.
  // Merge's panel docks here too, at the same width — WorkspaceDesignComparePanel.)
  const boardDockShown = dockShownOf({ boardShown, activeView, designComparePanelOpen })
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef(rightPanelWidth)
  const target = boardDockShown ? rightPanelWidth : 0
  const eased = useAfterPaint(target)
  const width = resizing ? target : eased
  return (
    <div data-board-dock inert={!boardDockShown || undefined} style={{ width }} className={cn('relative h-full shrink-0 overflow-hidden transition-[width]', DOCK_MOTION, resizing && 'transition-none')}>
      <div ref={setBoardDockHost} className="h-full" style={{ width: Math.max(target, width) }} />
      {/* Its left edge drags it wider or narrower (one width for 변경확인 and 병합); double-click: back to 480. */}
      {boardDockShown && (
        <SplitHandle
          label="Resize the right panel"
          value={Math.round(((rightPanelWidth - RIGHT_PANEL.min) / (RIGHT_PANEL.max - RIGHT_PANEL.min)) * 100)}
          className="absolute inset-y-0 left-0 z-20"
          onResizeStart={() => { dragStart.current = rightPanelWidth; setResizing(true) }}
          onResize={(dx) => setRightPanelWidth(dragStart.current - dx)}
          onResizeEnd={() => setResizing(false)}
          onStep={(d) => setRightPanelWidth(rightPanelWidth - d)}
          onReset={() => setRightPanelWidth(RIGHT_PANEL.width)}
        />
      )}
    </div>
  )
}
