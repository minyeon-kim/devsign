import { useEffect, useRef, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { assemblyToOverride } from '@/components/mergestudio/mergeEffects'
import { SNAP_PX, artboardRects, snapBox } from '@/components/mergestudio/snapGuides'

// Interactive placement for a Design System component pulled from the
// Block Deck's Library — instead of blindly appending it under the frame.
//
// A live, true-scale ghost of the component follows the cursor over either
// artboard (both show the same frame), with Figma-style smart guides: it
// snaps to the frame's center and to other layers' left / right / center
// edges, and to stacking 12px above / below / top / bottom-aligned with
// them. A position pill reads out the frame coordinates. Drop with a click
// (`mode: 'click'`, from the Add button) or by releasing the drag
// (`mode: 'drag'`, from dragging a Library preview). Esc, or a click / drop
// anywhere off the artboards, cancels.

// Where the cursor would drop the component, in frame units, or null when
// it isn't over an artboard.
function measure(clientX, clientY, frame, w, h) {
  for (const { clip, inner, k } of artboardRects(frame)) {
    if (clientX < clip.left || clientX > clip.right || clientY < clip.top || clientY > clip.bottom) continue
    const raw = { x: (clientX - inner.left) / k - w / 2, y: (clientY - inner.top) / k - h / 2 }
    const s = snapBox(frame, raw.x, raw.y, w, h, SNAP_PX / k)
    const x = Math.round(Math.min(Math.max(0, s.x), frame.width - w))
    const y = Math.round(Math.max(0, s.y))
    return { x, y, k, inner, clip, guideX: s.guideX, guideY: s.guideY }
  }
  return null
}

function PlacementOverlay({ def, mode, frame, onPlace, onCancel }) {
  const w = Math.min(def.width, frame.width - 24)
  const h = def.height
  const [pos, setPos] = useState(null)
  const posRef = useRef(null)
  const layer = { id: `ghost-${def.id}`, name: def.name, type: def.type, label: def.label, x: 0, y: 0, width: w, height: h }
  const override = { ...assemblyToOverride(def.assembly, layer), static: true }

  useEffect(() => {
    function move(e) {
      const hit = measure(e.clientX, e.clientY, frame, w, h)
      const next = { cx: e.clientX, cy: e.clientY, hit }
      posRef.current = next
      setPos(next)
    }
    function drop(e) {
      const hit = measure(e.clientX, e.clientY, frame, w, h)
      if (hit) onPlace({ x: hit.x, y: hit.y })
      else onCancel()
    }
    function key(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('keydown', key)
    if (mode === 'drag') window.addEventListener('pointerup', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerup', drop)
    }
  }, [def, mode, frame, w, h, onPlace, onCancel])

  const hit = pos?.hit
  const k = hit?.k ?? 0.6

  return (
    <div
      // Catches the click that drops the component (click mode) and keeps
      // the canvas underneath from selecting / panning meanwhile.
      className="fixed inset-0 z-[60]"
      style={{ cursor: hit ? 'copy' : 'not-allowed' }}
      onPointerDown={(e) => {
        if (mode !== 'click' || e.button !== 0) return
        e.preventDefault()
        const at = measure(e.clientX, e.clientY, frame, w, h)
        if (at) onPlace({ x: at.x, y: at.y })
        else onCancel()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="pointer-events-none absolute top-16 left-1/2 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-card/95 px-4 text-xs text-foreground shadow-2xl backdrop-blur-md">
        <MousePointerClick className="size-3.5 text-muted-foreground" />
        <span>
          <span className="font-semibold">{def.name}</span> — {mode === 'drag' ? 'release on an artboard to drop' : 'click on an artboard to place'}
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-inset ring-white/10">Esc to cancel</span>
      </div>

      {hit && (
        <>
          {hit.guideX != null && (
            <span
              className="pointer-events-none absolute w-px bg-rose-500"
              style={{ left: hit.inner.left + hit.guideX * k, top: hit.clip.top, height: hit.clip.height }}
            />
          )}
          {hit.guideY != null && (
            <span
              className="pointer-events-none absolute h-px bg-rose-500"
              style={{ top: hit.inner.top + hit.guideY * k, left: hit.clip.left, width: hit.clip.width }}
            />
          )}
        </>
      )}

      {pos && (
        <div
          className="pointer-events-none absolute"
          style={
            hit
              ? { left: hit.inner.left + hit.x * k, top: hit.inner.top + hit.y * k }
              : { left: pos.cx - (w * k) / 2, top: pos.cy - (h * k) / 2, opacity: 0.55 }
          }
        >
          <div className={hit ? 'rounded-[3px] outline outline-1 outline-offset-2 outline-dashed outline-rose-500' : undefined} style={{ width: w * k, height: h * k }}>
            <div className="relative" style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: 'top left' }}>
              <StaticLayer layer={layer} override={override} onSelect={() => {}} />
            </div>
          </div>
          {hit && (
            <span className="absolute top-full left-0 mt-1.5 rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-semibold whitespace-nowrap text-white tabular-nums">
              x {hit.x} · y {hit.y}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default PlacementOverlay
