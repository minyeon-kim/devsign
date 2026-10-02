import { moveTab } from '@/lib/tabOrder'
import { Fragment, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GitPullRequest, ScrollText, SquareTerminal, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { WorkspaceBottomPanelPortalContext } from '@/components/workspace/WorkspaceBottomPanelContext'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { conflictCounts } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

const DEFAULT_TABS = [
  { id: 'conflict', label: 'Conflict Points', icon: TriangleAlert, Panel: ConflictPanel },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, Panel: TerminalPanel },
  { id: 'console', label: 'Console', icon: ScrollText, Panel: ConsolePanel },
]

const STRIP_HEIGHT = 48
const MIN_HEIGHT = 120
// Leave the canvas at least this much room above the panel.
const MIN_CANVAS = 220

// The workspace's bottom panel — Terminal, Console and Conflict Points as
// one docked strip under the canvas (VS Code / Merge Studio style), not a
// window floating over it. It spans the workspace's full width on the
// panel surface with a hairline above; its tab row uses the studio's pill
// category tabs. Conflict Points sits with the Terminal and Console like
// a Problems tab, its open count badged on the tab. Drag the top edge to
// resize; switching tabs preserves the user's height, and content scrolls
// inside each panel rather than resizing this dock to fit it.
function WorkspaceBottomPanel({ tabs = DEFAULT_TABS, className, portal = false }) {
  const portalTarget = useContext(WorkspaceBottomPanelPortalContext)
  const { bottomPanel, setBottomPanel, conflicts, reviewConflictId, activeView, mergeCta } = useWorkspace()
  const { tab, open, height } = bottomPanel
  const rootRef = useRef(null)
  const [tabOrder, setTabOrder] = useState(() => tabs.map((t) => t.id))
  const draggedTab = useRef(null)
  const [availableHeight, setAvailableHeight] = useState(480)

  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const measure = () => setAvailableHeight(Math.max(MIN_HEIGHT, parent.clientHeight - MIN_CANVAS))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!reviewConflictId) return
    const target = Math.max(320, Math.round(window.innerHeight * 0.46))
    setBottomPanel({ open: true, height: target })
  }, [reviewConflictId, setBottomPanel])

  // Opening Conflict Points itself (the list, before any row is picked)
  // needs more room than the panel's small resting height — a fresh
  // session starts on Terminal at 240px, which is cramped for the list's
  // columns. Only grows, and only on the open transition itself, so it
  // never fights a height the user later drags down, and never re-fires
  // just from height changing while the tab stays open.
  useEffect(() => {
    if (tab !== 'conflict' || !open) return
    const target = Math.max(320, Math.round(window.innerHeight * 0.36))
    if (height < target) setBottomPanel({ height: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open])

  useLayoutEffect(() => {
    if (open && height > availableHeight) setBottomPanel({ height: availableHeight })
  }, [open, height, availableHeight, setBottomPanel])
  const { open: openConflicts } = conflictCounts(conflicts)

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
    const startHeight = open ? height : STRIP_HEIGHT
    const limit = maxHeight()
    document.body.style.cursor = 'row-resize'

    function onMove(m) {
      const next = Math.min(limit, Math.max(MIN_HEIGHT, startHeight + startY - m.clientY))
      setBottomPanel({ height: next, open: true })
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
      style={{ height: open ? height : STRIP_HEIGHT }}
      className={cn(
        // Merge Studio and plain Workspace share this exact styling — same
        // in-flow positioning, same rounding/margins when open, same flush
        // strip when closed. No portal-only branch, so they can't drift.
        'relative flex shrink-0 flex-col overflow-hidden transition-all duration-300',
        open
          ? 'z-[550] mt-0 mr-2 mb-2 ml-0 rounded-2xl border border-white/10 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-14px_rgba(0,0,0,0.65)]'
          : 'rounded-none border-transparent bg-[#050506] shadow-none',
        className
      )}
    >
      {/* Resize handle along the top edge. */}
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize bottom panel"
        className="absolute inset-x-4 top-0 z-10 h-1.5 cursor-row-resize rounded-full after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-emerald-400/0 after:transition-colors hover:after:bg-emerald-400/60"
      />

      <div
        className="flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2"
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
                  className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-300 p-0 text-[9px] leading-none font-bold text-[#050506] shadow-[0_0_10px_rgba(110,231,183,0.18)] tabular-nums"
                >
                  {openConflicts}
                </span>
              )}
            </button>
          </Fragment>
        ))}
        </div>
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
