import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { SNAP_PX, artboardRects, snapAxis, snapBox, xCandidates, yCandidates } from '@/components/mergestudio/snapGuides'

// Design-tool editing for a layer added from the Library, once it's
// selected: drag its body to move it, drag one of the 8 handles to resize
// it (both with the same smart-guide snapping as placement), and delete it
// from the little toolbar above it or with Delete / Backspace. Shown on
// every artboard displaying the frame (the original and the current one
// render the same added layers), in screen space, so handles stay a fixed
// size at any zoom. Geometry is in frame units; `onChange` fires live while
// dragging, `onDelete` removes the layer.
const MIN = 8
const HANDLES = [
  ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0],
  ['w', 0, 0.5], ['e', 1, 0.5],
  ['sw', 0, 1], ['s', 0.5, 1], ['se', 1, 1],
]
const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }

function isTyping() {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function LayerTransformHandles({ layerId, geom, frame, onChange, onDelete }) {
  const [boards, setBoards] = useState([])
  const [guides, setGuides] = useState(null)
  const drag = useRef(null)

  // Artboards pan / zoom / resize independently of React state here, so
  // follow them every frame (only re-rendering when something moved).
  useLayoutEffect(() => {
    let raf
    let last = ''
    function tick() {
      const next = artboardRects(frame)
      const sig = next.map((b) => [b.inner.left, b.inner.top, b.k, b.clip.left, b.clip.top, b.clip.width, b.clip.height].map(Math.round).join(',')).join('|')
      if (sig !== last) {
        last = sig
        setBoards(next)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [frame])

  // Delete / Backspace removes the selected added layer (not while typing).
  useEffect(() => {
    function key(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping()) {
        e.preventDefault()
        onDelete()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onDelete])

  function start(e, handle, k) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { handle, k, sx: e.clientX, sy: e.clientY, g: geom }
    function move(m) {
      const d = drag.current
      if (!d) return
      const dx = (m.clientX - d.sx) / d.k
      const dy = (m.clientY - d.sy) / d.k
      const t = SNAP_PX / d.k
      let { x, y, w, h } = d.g
      let gx, gy
      if (d.handle === 'move') {
        const s = snapBox(frame, x + dx, y + dy, w, h, t, layerId)
        x = s.x
        y = s.y
        gx = s.guideX
        gy = s.guideY
      } else {
        const hd = d.handle
        if (hd.includes('e')) {
          const right = snapAxis(x + w + dx, xCandidates(frame, 0, layerId), t)
          w = Math.max(MIN, (right ? right.value : x + w + dx) - x)
          gx = right?.guide
        }
        if (hd.includes('w')) {
          const left = snapAxis(x + dx, xCandidates(frame, 0, layerId), t)
          const nx = Math.min(left ? left.value : x + dx, x + w - MIN)
          w = x + w - nx
          x = nx
          gx = left?.guide
        }
        if (hd.includes('s')) {
          const bottom = snapAxis(y + h + dy, yCandidates(frame, 0, layerId), t)
          h = Math.max(MIN, (bottom ? bottom.value : y + h + dy) - y)
          gy = bottom?.guide
        }
        if (hd.includes('n')) {
          const top = snapAxis(y + dy, yCandidates(frame, 0, layerId), t)
          const ny = Math.min(top ? top.value : y + dy, y + h - MIN)
          h = y + h - ny
          y = ny
          gy = top?.guide
        }
      }
      x = Math.round(Math.min(Math.max(0, x), frame.width - Math.min(w, frame.width)))
      y = Math.round(Math.max(0, y))
      w = Math.round(Math.min(w, frame.width - x))
      h = Math.round(h)
      setGuides({ x: gx, y: gy })
      onChange({ x, y, w, h })
    }
    function up() {
      drag.current = null
      setGuides(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[25]">
      {boards.map(({ clip, inner, k }, i) => {
        const left = inner.left + geom.x * k
        const top = inner.top + geom.y * k
        const width = geom.w * k
        const height = geom.h * k
        return (
          <div key={i}>
            {guides?.x != null && <span className="absolute w-px bg-rose-500" style={{ left: inner.left + guides.x * k, top: clip.top, height: clip.height }} />}
            {guides?.y != null && <span className="absolute h-px bg-rose-500" style={{ top: inner.top + guides.y * k, left: clip.left, width: clip.width }} />}
            <div className="absolute" style={{ left, top, width, height }}>
              {/* Move: the whole body. */}
              <div
                title="Drag to move · Delete to remove"
                className="pointer-events-auto absolute inset-0 cursor-move rounded-[2px] ring-1 ring-sky-500"
                onPointerDown={(e) => start(e, 'move', k)}
                // Double-click still reaches the layer underneath (inline
                // text editing on the editable artboard).
                onDoubleClick={(e) => {
                  const el = e.currentTarget
                  el.style.pointerEvents = 'none'
                  const under = document.elementFromPoint(e.clientX, e.clientY)
                  el.style.pointerEvents = ''
                  under?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: e.clientX, clientY: e.clientY }))
                }}
              />
              {HANDLES.map(([id, fx, fy]) => (
                <span
                  key={id}
                  onPointerDown={(e) => start(e, id, k)}
                  className="pointer-events-auto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-sky-500 bg-white"
                  style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, cursor: CURSOR[id] }}
                />
              ))}
              {/* Contextual toolbar: size readout + delete. */}
              <div className="pointer-events-auto absolute bottom-full left-0 mb-2 flex h-7 items-center gap-1 rounded-full border border-white/10 bg-card/95 pr-1 pl-2.5 text-[11px] text-muted-foreground shadow-lg backdrop-blur-md">
                <span className="tabular-nums">
                  {geom.w} × {geom.h}
                </span>
                <button
                  type="button"
                  title="Delete (⌫)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onDelete}
                  className={cn('flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive')}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default LayerTransformHandles
