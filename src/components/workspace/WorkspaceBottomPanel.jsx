import { moveTab } from '@/lib/tabOrder'
import { useLayoutEffect, useRef, useState } from 'react'
import { ScrollText, SquareTerminal, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { conflictCounts } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

const TABS = [
  { id: 'conflict', label: 'Conflict Points', icon: TriangleAlert, Panel: ConflictPanel },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, Panel: TerminalPanel },
  { id: 'console', label: 'Console', icon: ScrollText, Panel: ConsolePanel },
]

const STRIP_HEIGHT = 40
const MIN_HEIGHT = 120
// Leave the canvas at least this much room above the panel.
const MIN_CANVAS = 220

// The workspace's bottom panel — Terminal, Console and Conflict Points as
// one docked strip under the canvas (VS Code / Merge Studio style), not a
// window floating over it. It spans the workspace's full width on the
// panel surface with a hairline above; its tab row uses the studio's pill
// category tabs. Conflict Points sits with the Terminal and Console like
// a Problems tab, its open count badged on the tab. Drag the top edge to
// resize; the single chevron opens to the list's content height (capped
// to leave canvas space) or collapses it down to just its tab strip.
function WorkspaceBottomPanel() {
  const { bottomPanel, setBottomPanel, conflicts, reviewConflictId } = useWorkspace()
  const { tab, open, height } = bottomPanel
  const rootRef = useRef(null)
  const [tabOrder, setTabOrder] = useState(() => TABS.map((t) => t.id))
  const draggedTab = useRef(null)
  const [contentHeight, setContentHeight] = useState(null)
  const [availableHeight, setAvailableHeight] = useState(480)
  const manuallySized = useRef(false)
  const previousMode = useRef(null)
  const mode = `${tab}:${open}:${reviewConflictId ? 'review' : 'list'}`
  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      previousMode.current = mode
      manuallySized.current = false
    }
  }, [mode])

  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const measure = () => setAvailableHeight(Math.max(MIN_HEIGHT, parent.clientHeight - MIN_CANVAS))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (tab !== 'conflict' || !open || contentHeight == null || manuallySized.current) return
    const fitted = Math.min(availableHeight, Math.max(MIN_HEIGHT, STRIP_HEIGHT + contentHeight + 1))
    if (height !== fitted) setBottomPanel({ height: fitted })
  }, [tab, open, contentHeight, availableHeight, height, setBottomPanel])
  const { open: openConflicts, needsMyReview } = conflictCounts(conflicts)

  function maxHeight() {
    const parentHeight = rootRef.current?.parentElement?.clientHeight ?? window.innerHeight
    return Math.max(MIN_HEIGHT, parentHeight - MIN_CANVAS)
  }
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]

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
    previousMode.current = `${tab}:true`
    manuallySized.current = true
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

  return (
    <section
      ref={rootRef}
      aria-label="Bottom panel"
      style={{ height: open ? height : STRIP_HEIGHT }}
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden transition-all duration-300',
        open
          ? 'mx-3 mb-2 rounded-2xl border border-white/10 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-14px_rgba(0,0,0,0.65)]'
          : 'rounded-none border-transparent bg-[#050506] shadow-none'
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
        className="flex shrink-0 cursor-pointer items-center gap-1 px-3"
        style={{ height: STRIP_HEIGHT }}
        role="tablist"
        onClick={(event) => {
          // Tab and action buttons own their click behavior. Empty space in
          // the strip acts as a quick expand/collapse affordance.
          if (event.target.closest('button')) return
          setBottomPanel({ open: !open })
        }}
      >
        {tabOrder.map((id) => TABS.find((t) => t.id === id)).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
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
            className={cn(CATEGORY_TAB, 'h-7 gap-1.5 px-3 text-xs', id === tab && open ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
          >
            <Icon className="size-3.5" />
            {label}
            {id === 'conflict' && openConflicts > 0 && (
              <span
                title={`${openConflicts} open`}
                className="rounded-full bg-white/[0.08] px-1.5 text-[10px] leading-4 font-semibold text-slate-300 tabular-nums"
              >
                {openConflicts}
              </span>
            )}
          </button>
        ))}
        {/* Your share of the open ones, kept apart from the total: jumps to
            the Conflict Points list filtered to what needs your review. */}
        {needsMyReview > 0 && (
          <button
            type="button"
            onClick={() => setBottomPanel({ tab: 'conflict', open: true, conflictFilter: 'mine' })}
            className="ml-1 inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
          >
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Needs your review · {needsMyReview}
          </button>
        )}
      </div>

      {open && (
        <div role="tabpanel" aria-label={active.label} className="min-h-0 flex-1 overflow-hidden">
          <Panel onContentHeightChange={tab === 'conflict' ? setContentHeight : undefined} />
        </div>
      )}
    </section>
  )
}

export default WorkspaceBottomPanel
