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
// Opening the panel by hand (a tab, the strip) rises to half the window —
// a sliver of a list isn't worth opening. A taller height dragged before
// is kept.
const OPEN_SHARE = 0.5
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
  const { bottomPanel, setBottomPanel, conflicts, mergeItems, reviewConflictId, reviewView, checkGuide } = useWorkspace()
  const { tab, open, height, userHeight, maximized } = bottomPanel
  const [fullHeight, setFullHeight] = useState(640)
  const rootRef = useRef(null)
  const [tabOrder, setTabOrder] = useState(() => tabs.map((t) => t.id))
  const draggedTab = useRef(null)
  const [availableHeight, setAvailableHeight] = useState(480)
  // The height while the top edge is being dragged: drawn straight from the
  // pointer (no transition, no saved state, nothing else re-rendered), and
  // kept as the panel's height once it's let go.
  const [dragHeight, setDragHeight] = useState(null)
  const openedByDrag = useRef(false)

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

  // Opening a review opens the panel — when one is opened, not whenever the
  // panel mounts: coming back from Merge Studio mounts it afresh with the
  // last review still selected, and that mustn't pop the panel up.
  const shownReviewId = useRef(reviewConflictId)
  useEffect(() => {
    if (shownReviewId.current === reviewConflictId) return
    shownReviewId.current = reviewConflictId
    // (A review in the full-screen viewer doesn't open or resize this panel.)
    if (!reviewConflictId || reviewView === 'overlay') return
    // Fixing a check on the canvas (see CheckDecisions): the review was
    // folded on purpose so the marked element is in view — leave it folded.
    if (checkGuide?.conflictId === reviewConflictId) return
    // A height the user dragged to is theirs: it's what opens. Otherwise
    // the default share of the window.
    // (Never a sliver: a tiny saved height — an old stray click on the
    // edge — opens at the list's usual height.)
    const target = userHeight != null ? Math.max(LIST_MIN_HEIGHT, userHeight) : Math.max(REVIEW_MIN_HEIGHT, Math.round(window.innerHeight * REVIEW_SHARE))
    setBottomPanel({ open: true, height: target, tab: reviewTabFor(conflicts.find(record => record.id === reviewConflictId) ?? { id: reviewConflictId }) })
  }, [reviewConflictId, setBottomPanel])

  // Opening (any tab): at least half the window, or the taller height the
  // user dragged to before. Only grows, and only on the open transition
  // itself — never fights a height dragged afterwards. (Opened by dragging
  // the edge up: the drag sets the height.)
  useEffect(() => {
    if (!open || maximized) return
    if (openedByDrag.current) { openedByDrag.current = false; return }
    const parentHeight = rootRef.current?.parentElement?.clientHeight ?? window.innerHeight
    const target = Math.min(maxHeight(), Math.max(LIST_MIN_HEIGHT, Math.round(parentHeight * OPEN_SHARE), userHeight ?? 0))
    if (height < target) setBottomPanel({ height: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The bottom bar's height, published as `--ds-bottom-panel-offset`:
  // notifications and toasts sit just above it — always there, open or
  // not (above the open panel they'd float up the middle of the screen).
  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ds-bottom-panel-offset', `${STRIP_HEIGHT}px`)
    return () => root.style.removeProperty('--ds-bottom-panel-offset')
  }, [])

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
    document.body.style.userSelect = 'none'
    let latest = null
    let frame = 0

    function onMove(m) {
      // (A press that barely moves is a click, not a resize.)
      if (latest == null && Math.abs(m.clientY - startY) < 4) return
      latest = Math.min(limit, Math.max(MIN_HEIGHT, startHeight + startY - m.clientY))
      // One update a frame, however fast the pointer reports.
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setDragHeight(latest) })
    }
    function onUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDragHeight(null)
      // A click on the edge of the closed panel opens it at its full,
      // usual size — as a tab does — not a sliver.
      if (latest == null) {
        if (!open) setBottomPanel({ open: true })
        return
      }
      // A short pull up from closed opens it at its usual size too; only
      // a real drag sets (and keeps) a height of its own.
      if (!open && latest < LIST_MIN_HEIGHT * 0.6) {
        setBottomPanel({ open: true, maximized: false })
        return
      }
      if (!open) openedByDrag.current = true
      setBottomPanel({ height: latest, userHeight: latest, open: true, maximized: false })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const Panel = active.Panel

  const panel = (
    <section
      ref={rootRef}
      aria-label="Bottom panel"
      data-maximized={open && maximized ? '' : undefined}
      style={{ height: dragHeight ?? (!open ? STRIP_HEIGHT : maximized ? fullHeight : height) }}
      data-resizing={dragHeight != null ? '' : undefined}
      className={cn(
        // Merge Studio and plain Workspace share the exact same look and
        // place: the panel takes its own room at the bottom and the panes
        // above end over it (rounded, inset), rather than Merge Studio's
        // canvas running on underneath and being cut off by it.
        // (No transition while dragging: the edge stays under the pointer.)
        'relative flex shrink-0 flex-col overflow-hidden',
        dragHeight == null && 'transition-[height] duration-200 ease-out',
        open || dragHeight != null
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
        // (A 12px band along the whole edge — easy to catch with the mouse;
        // the panel clips anything outside it, so it sits just inside.)
        className="group/grip absolute inset-x-0 top-0 z-10 flex h-3 cursor-row-resize touch-none justify-center after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-emerald-400/0 after:transition-colors hover:after:bg-emerald-400/60"
      >
        <span aria-hidden className={cn('mt-1 h-1 w-10 rounded-full transition-colors group-hover/grip:bg-emerald-300/80', dragHeight != null ? 'bg-emerald-300/80' : 'bg-white/20')} />
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
