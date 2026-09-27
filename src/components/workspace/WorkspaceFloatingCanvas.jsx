import { useEffect, useRef, useState } from 'react'
import ExplorerPanel from '@/components/dockview/panels/ExplorerPanel'
import LayersPanel from '@/components/dockview/panels/LayersPanel'
import AssetsPanel from '@/components/dockview/panels/AssetsPanel'
import CanvasPanel from '@/components/dockview/panels/CanvasPanel'
import EditorPanel from '@/components/dockview/panels/EditorPanel'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import TerminalPanel from '@/components/dockview/panels/TerminalPanel'
import ConsolePanel from '@/components/dockview/panels/ConsolePanel'
import ConflictPanel from '@/components/dockview/panels/ConflictPanel'
import LayerInspectPanel from '@/components/dockview/panels/LayerInspectPanel'
import { buildInitialLayout } from '@/components/dockview/DockLayout'
import FloatingWindow from '@/components/workspace/FloatingWindow'
import { useFloatingDockApi, CANVAS_W, CANVAS_H } from '@/components/workspace/floatingDockApi'
import { useWorkspace } from '@/state/WorkspaceProvider'

const components = {
  explorer: ExplorerPanel,
  layers: LayersPanel,
  assets: AssetsPanel,
  canvas: CanvasPanel,
  editor: EditorPanel,
  preview: PreviewPanelContent,
  terminal: TerminalPanel,
  console: ConsolePanel,
  conflict: ConflictPanel,
  layerInspect: LayerInspectPanel,
}

const MIN_ZOOM = 40
const MAX_ZOOM = 150
const ZOOM_STEP = 10

// Replaces dockview's split-pane workspace with a Merge-Studio-style
// pannable/zoomable canvas of freely draggable/resizable windows — same
// dot-grid background, same opaque glass-free card surface. `dockApi` (see
// floatingDockApi.js) is a facade shaped exactly like dockview-react's own
// API, so ActivityBar/LayoutMenu/CanvasPanel's layer-inspect tabs and the
// Preview toggle all keep working against it completely unchanged; only
// this rendering layer is new.
function WorkspaceFloatingCanvas() {
  const { setDockApi } = useWorkspace()
  const { dockApi, store } = useFloatingDockApi()
  const [view, setView] = useState({ x: 32, y: 16, zoom: 100 })
  const [panning, setPanning] = useState(false)
  const viewportRef = useRef(null)
  const didInit = useRef(false)

  useEffect(() => {
    setDockApi(dockApi)
    return () => setDockApi(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockApi])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    buildInitialLayout(dockApi)

    // Zoom-to-fit the freshly built layout into whatever viewport we
    // actually have, instead of a hand-tuned fixed pan/zoom that only
    // looks right at one window size — the default layout's real pixel
    // footprint depends on floatingDockApi's split math, not a size we
    // control directly here.
    const groups = Object.values(store.groups)
    const rect = viewportRef.current?.getBoundingClientRect()
    if (groups.length > 0 && rect) {
      const minX = Math.min(...groups.map((g) => g.x))
      const minY = Math.min(...groups.map((g) => g.y))
      const maxX = Math.max(...groups.map((g) => g.x + g.w))
      const maxY = Math.max(...groups.map((g) => g.y + g.h))
      // Wider on the left/top than the other two edges — clearing the
      // floating ActivityBar pill (left-4, w-12) and the TopBar pills
      // (top-3, h-10) so the default layout doesn't start out tucked
      // behind either of them.
      const leftMargin = 96
      const topMargin = 72
      const margin = 32
      const fitZoom = Math.min(
        MAX_ZOOM,
        100,
        ((rect.width - leftMargin - margin) / (maxX - minX)) * 100,
        ((rect.height - topMargin - margin) / (maxY - minY)) * 100
      )
      const zoom = Math.max(MIN_ZOOM, fitZoom)
      const k = zoom / 100
      setView({
        zoom,
        x: leftMargin - minX * k + Math.max(0, (rect.width - leftMargin - margin - (maxX - minX) * k) / 2),
        y: topMargin - minY * k,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startPan(e) {
    if (e.target !== e.currentTarget || e.button !== 0) return
    e.preventDefault()
    const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
    setPanning(true)
    function onMove(m) {
      setView((v) => ({ ...v, x: start.vx + m.clientX - start.px, y: start.vy + m.clientY - start.py }))
    }
    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        setView((v) => {
          const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-e.deltaY * 0.01)))
          const k = nextZoom / v.zoom
          return { zoom: nextZoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
        })
        return
      }
      e.preventDefault()
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function zoomBy(delta) {
    const rect = viewportRef.current.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    setView((v) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + delta))
      const k = nextZoom / v.zoom
      return { zoom: nextZoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }

  const scale = view.zoom / 100
  const gridSize = 18 * scale
  const groups = Object.values(store.groups)

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-800">
      <div
        ref={viewportRef}
        onPointerDown={startPan}
        className="absolute inset-0 overflow-hidden"
        style={{
          cursor: panning ? 'grabbing' : 'grab',
          touchAction: 'none',
          backgroundImage:
            'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`, transformOrigin: '0 0' }}
        >
          <div className="pointer-events-auto" style={{ width: CANVAS_W, height: CANVAS_H }}>
            {groups.map((group) => (
              <FloatingWindow key={group.id} group={group} panelsById={store.panels} dockApi={dockApi} components={components} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom-right zoom pill, same family as Merge Studio's own —
          right-20 (not right-3) so it clears ChatMorphWidget's collapsed
          bubble (48px + 16px margin, fixed to the same corner). */}
      <div
        data-zoom-control
        className="absolute right-20 bottom-3 z-20 flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-card/90 px-2 text-sm shadow-lg backdrop-blur-md"
      >
        <button
          type="button"
          title="Zoom out"
          onClick={() => zoomBy(-ZOOM_STEP)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          −
        </button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.zoom)}%</span>
        <button
          type="button"
          title="Zoom in"
          onClick={() => zoomBy(ZOOM_STEP)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default WorkspaceFloatingCanvas
