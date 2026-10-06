import WorkspaceDesignCompare from '@/components/workspace/WorkspaceDesignCompare'
import { moveTab } from '@/lib/tabOrder'
import { Fragment, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Layers3, Maximize2, Minimize2, ScrollText, SquareTerminal, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { WorkspaceBottomPanelPortalContext } from '@/components/workspace/WorkspaceBottomPanelContext'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { conflictCounts, reviewTabFor } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

const DEFAULT_TABS = [
  { id: 'conflict', label: 'Conflict Points', icon: TriangleAlert, Panel: ConflictPanel },
  { id: 'design-compare', label: 'Design Compare', icon: Layers3, Panel: WorkspaceDesignCompare },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, Panel: TerminalPanel },
  { id: 'console', label: 'Console', icon: ScrollText, Panel: ConsolePanel },
]

const STRIP_HEIGHT = 40
const MIN_HEIGHT = 120
// Leave the work area above at least this much room (maximizing the panel
// is the one way past it).
const MIN_CANVAS = 140
// What opening rises to: the Conflict Points list takes close to half the
// window, a review a little more — its cards, code and thread need the
// height more than the canvas behind them does while it's open.
const LIST_MIN_HEIGHT = 360
const REVIEW_MIN_HEIGHT = 440
// A review opens at about this much of the window: its comparison, code
// diff and reasoning need the height more than the work area above does.
const REVIEW_SHARE = 0.6

// The workspace's bottom panel — Terminal, Console and Conflict Points as
// one docked strip under the canvas (VS Code / Merge Studio style), not a
// window floating over it. It spans the workspace's full width on the
// panel surface with a hairline above; its tab row uses the studio's pill
// category tabs. Conflict Points sits with the Terminal and Console like
// a Problems tab, its open count badged on the tab. Drag the grip on its top
// edge to resize — a height set that way is kept (`userHeight`, saved with
// the panel's state) and is what it opens to from then on — or use the
// button at the strip's right to maximize it to the full height and back.
// Content scrolls inside each panel rather than resizing this dock to fit.
function WorkspaceBottomPanel({ tabs = DEFAULT_TABS, className, portal = false }) {
  const portalTarget = useContext(WorkspaceBottomPanelPortalContext)
  const { bottomPanel, setBottomPanel, conflicts, mergeItems, reviewConflictId, checkGuide } = useWorkspace()
  const { tab, open, height, userHeight, maximized } = bottomPanel
  const [fullHeight, setFullHeight] = useState(640)
  const rootRef = useRef(null)
  const [tabOrder, setTabOrder] = useState(() => tabs.map((t) => t.id))
  const draggedTab = useRef(null)
  const [availableHeight, setAvailableHeight] = useState(480)

  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const measure = () => {
      setAvailableHeight(Math.max(MIN_HEIGHT, parent.clientHeight - MIN_CANVAS))
      setFullHeight(Math.max(MIN_HEIGHT, parent.clientHeight - 8))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!reviewConflictId) return
    // Fixing a check on the canvas (see CheckDecisions): the review was
    // folded on purpose so the marked element is in view — leave it folded.
    if (checkGuide?.conflictId === reviewConflictId) return
    // A height the user dragged to is theirs: it's what opens. Otherwise
    // the default share of the window.
    const target = userHeight ?? Math.max(REVIEW_MIN_HEIGHT, Math.round(window.innerHeight * REVIEW_SHARE))
    setBottomPanel({ open: true, height: target, tab: reviewTabFor(conflicts.find(record => record.id === reviewConflictId) ?? { id: reviewConflictId }) })
  }, [reviewConflictId, setBottomPanel])

  // Opening Conflict Points itself (the list, before any row is picked)
  // needs more room than the panel's small resting height — a fresh
  // panel may have been resized smaller while showing another tab.
  // Only grows, and only on the open transition itself, so it
  // never fights a height the user later drags down, and never re-fires
  // just from height changing while the tab stays open.
  useEffect(() => {
    if (!['conflict', 'design-compare'].includes(tab) || !open) return
    if (userHeight) { if (height !== userHeight) setBottomPanel({ height: userHeight }); return }
    const target = Math.max(LIST_MIN_HEIGHT, Math.round(window.innerHeight * 0.46))
    if (height < target) setBottomPanel({ height: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open])

  useLayoutEffect(() => {
    if (open && height > availableHeight) setBottomPanel({ height: availableHeight })
  }, [open, height, availableHeight, setBottomPanel])
  const { open: openConflicts } = conflictCounts(conflicts)
  const designSets = mergeItems.filter((item) => item.hasDesign).length

  function maxHeight() {
    const parentHeight = rootRef.current?.parentElement?.clientHeight ?? window.innerHeight
    return Math.max(MIN_HEIGHT, parentHeight - MIN_CANVAS)
  }
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]

  function pickTab(id) {
    if (id === tab && open) setBottomPanel({ open: false })
    else setBottomPanel({ tab: id, open: true })
  }

  function startResize(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const startY = event.clientY
    // Dragging from maximized starts from the full height and leaves it.
    const startHeight = !open ? STRIP_HEIGHT : maximized ? fullHeight : height
    const limit = maxHeight()
    document.body.style.cursor = 'row-resize'

    function onMove(m) {
      const next = Math.min(limit, Math.max(MIN_HEIGHT, startHeight + startY - m.clientY))
      setBottomPanel({ height: next, userHeight: next, open: true, maximized: false })
    }
    function onUp() {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const Panel = active.Panel

  const panel = (
    <section
      ref={rootRef}
      aria-label="Bottom panel"
      data-maximized={open && maximized ? '' : undefined}
      style={{ height: !open ? STRIP_HEIGHT : maximized ? fullHeight : height }}
      className={cn(
        // Merge Studio and plain Workspace share the exact same look (same
        // rounding/margins/border when open, same flush strip when closed)
        // — only *positioning* differs: Merge Studio floats the panel over
        // a full-size canvas instead of shrinking it, so the infinite
        // canvas never resizes under the user while panel height changes.
        'flex shrink-0 flex-col overflow-hidden transition-all duration-300',
        portal ? 'absolute inset-x-0 bottom-0' : 'relative',
        open
          ? 'z-[550] mt-0 mr-2 mb-2 ml-0 rounded-2xl border border-white/10 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-14px_rgba(0,0,0,0.65)]'
          : 'rounded-none border-transparent bg-background shadow-none',
        className
      )}
    >
      {/* Resize handle along the top edge: the whole edge drags, and a
          grip at its middle shows that it does. */}
      <div
        onPointerDown={startResize}
        onDoubleClick={() => setBottomPanel({ open: true, maximized: !maximized })}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize bottom panel"
        title="Drag to resize · double-click to maximize"
        className="group/grip absolute inset-x-4 top-0 z-10 flex h-2.5 cursor-row-resize justify-center after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-emerald-400/0 after:transition-colors hover:after:bg-emerald-400/60"
      >
        <span aria-hidden className="mt-1 h-1 w-10 rounded-full bg-white/20 transition-colors group-hover/grip:bg-emerald-300/80" />
      </div>

      <div
        className="flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1"
        style={{ height: STRIP_HEIGHT }}
        role="tablist"
        onClick={(event) => {
          // Tab and action buttons own their click behavior. Empty space in
          // the strip acts as a quick expand/collapse affordance.
          if (event.target.closest('button')) return
          setBottomPanel({ open: !open })
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {tabOrder.map((id) => tabs.find((t) => t.id === id)).filter(Boolean).map(({ id, label, icon: Icon }) => (
          <Fragment key={id}>
            <button
              type="button"
              role="tab"
              aria-description={`Open ${label} · Drag to reorder`}
              aria-selected={id === tab}
              draggable
              onDragStart={(event) => {
                draggedTab.current = id
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', id)
              }}
              onDragOver={(event) => { if (draggedTab.current) event.preventDefault() }}
              onDrop={(event) => {
                if (!draggedTab.current) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const source = draggedTab.current
                const after = event.clientX >= rect.left + rect.width / 2
                setTabOrder((prev) => moveTab(prev, source, id, after))
              }}
              onDragEnd={() => { draggedTab.current = null }}
              onKeyDown={(event) => {
                if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
                const direction = event.key === 'ArrowRight' ? 1 : -1
                const target = tabOrder[tabOrder.indexOf(id) + direction]
                if (!target) return
                event.preventDefault()
                setTabOrder((prev) => moveTab(prev, id, target, direction > 0))
              }}
              onClick={() => pickTab(id)}
              className={cn(CATEGORY_TAB, 'h-7 gap-1.5 px-2.5 text-[11px]', id === tab && open ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
            >
              <Icon className="size-3" />
              {label}
              {id === 'conflict' && openConflicts > 0 && (
                <span
                  title={`${openConflicts} open`}
                  className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-300 p-0 text-[9px] leading-none font-bold text-[#050505] shadow-[0_0_10px_rgba(110,231,183,0.18)] tabular-nums"
                >
                  {openConflicts}
                </span>
              )}
              {id === 'design-compare' && designSets > 0 && (
                <span
                  title={`${designSets} design sets`}
                  className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#5CE0AE] p-0 text-[9px] leading-none font-bold text-[#050505] tabular-nums"
                >
                  {designSets}
                </span>
              )}
            </button>
          </Fragment>
        ))}
        </div>
        {/* The whole height in one press, and back to where it was. */}
        {open && (
          <button
            type="button"
            data-panel-maximize
            aria-pressed={Boolean(maximized)}
            aria-label={maximized ? 'Restore panel height' : 'Maximize panel'}
            title={maximized ? 'Restore panel height' : 'Maximize panel'}
            onClick={() => setBottomPanel({ maximized: !maximized })}
            className="ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        )}
      </div>

      {open && (
        <div role="tabpanel" aria-label={active.label} className="min-h-0 flex-1 overflow-hidden">
          <Panel {...active.panelProps} />
        </div>
      )}
    </section>
  )

  return portal ? (portalTarget ? createPortal(panel, portalTarget) : null) : panel
}

export default WorkspaceBottomPanel
