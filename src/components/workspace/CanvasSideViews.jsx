import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { Component, Files, Layers, ScanEye, X } from 'lucide-react'
import { cn } from 'cn'
import NavigatorPanel from '@/components/dockview/panels/NavigatorPanel'
import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { inCanvasViewOf } from '@/lib/panelPrefs'
import { PANE_MOTION } from '@/lib/useAfterPaint'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Files · Layers · Assets · Inspect, in the main window: a row of icons in its tab row, right after the
// Preview · Screens · Code tabs (a rule before them, and one before Inspect) — nothing floats over the
// canvas. An icon opens its view in a panel just under it, over the canvas (or the preview, or the code)
// — another icon swaps it, the same icon (or ×) puts it away. It's the side panel's own state (`sidePanel.open`, the
// navigator's tab), so ⌘B and anything that asks for a view still work;
// only Terminal and Console still open in the side panel itself.
const VIEWS = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: Component },
  { id: 'inspect', label: 'Inspect', icon: ScanEye, rule: true },
]
const RULE = 'mx-1.5 h-4 w-px shrink-0 bg-white/10'
export const CANVAS_VIEW_WIDTH = 280

export function CanvasViewRail() {
  const { sidePanel, filesWindow, toggleSideView } = useWorkspace()
  const language = useLanguage()
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  return (
    // (In the tab row: 28px buttons, 2px apart — transparent, faint; white 6% under the pointer; the open
    // one on surface-2 in the plain text colour.)
    <div data-canvas-view-rail role="toolbar" aria-orientation="horizontal" aria-label={translateText('Workspace views', language)} onPointerDown={(event) => event.stopPropagation()} className="flex shrink-0 items-center gap-0.5">
      <span aria-hidden className={RULE} />
      {VIEWS.map(({ id, label, icon: Icon, rule }) => (
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
            className={cn('ds-intrinsic flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
              open === id ? 'bg-[var(--ds-surface-2)] text-slate-100' : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200')}
          >
            <Icon className="size-4" />
          </button>
        </Fragment>
      ))}
    </div>
  )
}

// The view, opened just under its icon (lined up with the row of icons, kept inside the window), over
// the canvas, its width easing in and out.
export function CanvasViewPanel() {
  const { sidePanel, filesWindow, setSidePanel } = useWorkspace()
  const open = inCanvasViewOf(sidePanel, filesWindow.tab)
  const title = VIEWS.find((view) => view.id === open)?.label
  const ref = useRef(null)
  const [left, setLeft] = useState(8)
  useLayoutEffect(() => {
    const panel = ref.current
    const host = panel?.offsetParent
    const button = open && document.querySelector(`[data-canvas-view="${open}"]`)
    if (!panel || !host || !button) return
    const room = host.getBoundingClientRect()
    setLeft(Math.round(Math.max(8, Math.min(room.width - CANVAS_VIEW_WIDTH - 8, button.getBoundingClientRect().left - room.left))))
  }, [open])
  return (
    <div
      ref={ref}
      id="canvas-view-panel"
      data-canvas-view-panel={open ?? undefined}
      inert={!open || undefined}
      aria-hidden={!open || undefined}
      style={{ width: open ? CANVAS_VIEW_WIDTH : 0, left }}
      className={cn('absolute top-1 bottom-2 z-30 overflow-hidden rounded-xl transition-[width,opacity] motion-reduce:transition-none', PANE_MOTION,
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

// Design Compare, floating over the canvas's left (the activity bar's Design Compare): the design sets as a list at its left and their drafts beside it — wide enough for both.
export function CanvasComparePanel() {
  const { compareOpen, setCompareOpen } = useWorkspace()
  if (!compareOpen) return null
  return (
    <section
      id="canvas-compare-panel"
      data-canvas-compare
      aria-label="Design Compare"
      className="absolute inset-y-2 left-2 z-30 flex w-[min(760px,calc(100%-16px))] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-card shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-left-2 duration-200 motion-reduce:animate-none"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] pr-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-100"><LocalizedText text="Design Compare" /></span>
        <button type="button" data-canvas-compare-close aria-label="Close" title="Close" onClick={() => setCompareOpen(false)}
          className="ds-intrinsic flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1"><WorkspaceDesignCompare /></div>
    </section>
  )
}
