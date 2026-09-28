import { useRef } from 'react'
import { ChevronDown, ChevronUp, ScrollText, SquareTerminal, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

const TABS = [
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, Panel: TerminalPanel },
  { id: 'console', label: 'Console', icon: ScrollText, Panel: ConsolePanel },
  { id: 'conflict', label: 'Conflict Points', icon: TriangleAlert, Panel: ConflictPanel },
]

const STRIP_HEIGHT = 40
const MIN_HEIGHT = 120
// Leave the canvas at least this much room above the panel.
const MIN_CANVAS = 220

// The workspace's bottom panel — Terminal, Console and Conflict Points as
// one docked strip under the canvas (VS Code / Merge Studio style), not a
// window floating over it. It spans the workspace's full width on the
// panel surface with a hairline above; its tab row uses the studio's pill
// category tabs. Conflict Points' open count is badged once, on the
// activity bar's icon (which opens this tab), not repeated here. Drag the
// top edge to resize; the chevron (or clicking
// the active tab) collapses it down to just its tab strip.
function WorkspaceBottomPanel() {
  const { bottomPanel, setBottomPanel } = useWorkspace()
  const { tab, open, height } = bottomPanel
  const rootRef = useRef(null)
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
    const parentHeight = rootRef.current?.parentElement?.clientHeight ?? window.innerHeight
    const maxHeight = Math.max(MIN_HEIGHT, parentHeight - MIN_CANVAS)
    document.body.style.cursor = 'row-resize'

    function onMove(m) {
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight + startY - m.clientY))
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
      className="relative flex shrink-0 flex-col border-t border-white/[0.08] bg-card"
    >
      {/* Resize handle along the top edge. */}
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize bottom panel"
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize after:absolute after:inset-x-0 after:top-1 after:h-px after:bg-emerald-400/0 after:transition-colors hover:after:bg-emerald-400/60"
      />

      <div className="flex shrink-0 items-center gap-1 px-3" style={{ height: STRIP_HEIGHT }} role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === tab}
            onClick={() => pickTab(id)}
            className={cn(CATEGORY_TAB, 'gap-1.5', id === tab && open ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBottomPanel({ open: !open })}
          title={open ? 'Collapse panel' : 'Expand panel'}
          aria-label={open ? 'Collapse panel' : 'Expand panel'}
          aria-expanded={open}
          className="ml-auto flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>

      {open && (
        <div role="tabpanel" aria-label={active.label} className="min-h-0 flex-1 overflow-hidden">
          <Panel />
        </div>
      )}
    </section>
  )
}

export default WorkspaceBottomPanel
