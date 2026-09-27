import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { SNAP_PX, snapAxis, snapBox, xCandidates, yCandidates } from '@/components/mergestudio/snapGuides'

// Figma-style direct manipulation for the selected canvas element: drag its
// body to move it and any of the 8 handles to resize it, with smart-guide
// snapping (frame center, other layers' edges / centers, 12px stacking).
//
// Handles sit on the artboards where the edit actually renders (`boards`:
// frame keys, 'a' = Original Design, 'b' = Current Implementation) and
// measure the *rendered* element there (via `data-layer-id`), so drift /
// preset size changes are accounted for. Geometry is reported in frame
// units, live while dragging, through `onChange({ x, y, w, h })`. An
// optional mini toolbar offers `onDelete` (also Delete / Backspace) and
// `onReset`. Drawn in screen space, so handles stay one size at any zoom;
// the canvas's own green selection box and size pill carry on around them.
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

// The element on each requested artboard: its screen rect, the artboard's
// clip rect, scale, and the element's geometry in frame units.
function measureBoards(boards, layerId, frame) {
  return boards.flatMap((key) => {
    const box = document.querySelector(`[data-frame-key="${key}"] [data-frame-box]`)
    const innerEl = box?.firstElementChild
    const el = box?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`)
    if (!box || !innerEl || !el) return []
    const clip = box.getBoundingClientRect()
    const inner = innerEl.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!inner.width || !r.width) return []
    const k = inner.width / frame.width
    return [{
      key, clip, inner, k, rect: r,
      geom: { x: (r.left - inner.left) / k, y: (r.top - inner.top) / k, w: r.width / k, h: r.height / k },
    }]
  })
}

function LayerTransformHandles({ layerId, frame, boards, onChange, onDelete, onReset }) {
  const [found, setFound] = useState([])
  const [guides, setGuides] = useState(null)
  const drag = useRef(null)

  // The artboards pan / zoom / resize and the element restyles outside this
  // component's state, so follow them every frame (re-rendering only when
  // something actually moved).
  useLayoutEffect(() => {
    let raf
    let last = ''
    function tick() {
      const next = measureBoards(boards, layerId, frame)
      const sig = next.map((b) => [b.rect.left, b.rect.top, b.rect.width, b.rect.height, b.clip.left, b.clip.top, b.clip.width, b.clip.height].map(Math.round).join(',')).join('|')
      if (sig !== last) {
        last = sig
        setFound(next)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [boards, layerId, frame])

  // Delete / Backspace removes the element, when deleting is allowed (not
  // while typing in a field).
  useEffect(() => {
    if (!onDelete) return
    function key(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping()) {
        e.preventDefault()
        onDelete()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onDelete])

  function start(e, handle, board) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { handle, k: board.k, sx: e.clientX, sy: e.clientY, g: board.geom }
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
      {found.map((board) => {
        const { clip, inner, k, rect } = board
        return (
          <div key={board.key}>
            {guides?.x != null && <span className="absolute w-px bg-rose-500" style={{ left: inner.left + guides.x * k, top: clip.top, height: clip.height }} />}
            {guides?.y != null && <span className="absolute h-px bg-rose-500" style={{ top: inner.top + guides.y * k, left: clip.left, width: clip.width }} />}
            <div className="absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
              {/* Move: the whole body. */}
              <div
                title="Drag to move"
                className="pointer-events-auto absolute inset-0 cursor-move"
                onPointerDown={(e) => start(e, 'move', board)}
                // Double-click still reaches the element underneath (inline
                // text editing on the Current Implementation artboard).
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
                  onPointerDown={(e) => start(e, id, board)}
                  className="pointer-events-auto absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-emerald-500 bg-white shadow-sm"
                  style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, cursor: CURSOR[id] }}
                />
              ))}
              {(onDelete || onReset) && (
                <div className="pointer-events-auto absolute bottom-full left-0 mb-2 flex h-7 items-center gap-0.5 rounded-full border border-white/10 bg-card/95 px-1 shadow-lg backdrop-blur-md">
                  {onReset && (
                    <button
                      type="button"
                      title="Reset position & size"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onReset}
                      className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Delete (⌫)"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onDelete}
                      className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default LayerTransformHandles
