import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus, Scan, X } from 'lucide-react'
import { cn } from 'cn'

// The resolution's two pictures — what's built now, and the result picked —
// opened large, the way an image opens on Pinterest: the picture itself grows
// from where it sits in the detail to the middle of the screen (and shrinks
// back there on closing), over a dark canvas that fades in behind it. No card
// around it; the few controls float.
//
//   · Fitted to 84% of the screen to begin with; − / + step through
//     50–200% of that (or the wheel / a pinch), and a picture bigger than the
//     screen is dragged about. "Fit" puts it back.
//   · At the left, the two pictures small: the one in view is marked, and
//     the other is a press away — the large one cross-fades, nothing closes.
//   · Esc, ✕ or a press on the canvas closes it; a press on the picture doesn't.
// The pictures are the detail's own, drawn live (`render(id, width)`), so a
// way picked while it's open is what it shows.
//
//   items: [{ id, label }];  sourceOf(id): the thumbnail's element, where it grows from and goes back to.

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURATION = 300
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Where the picture sits large: its own shape, as big as fits in 84% of the screen.
export function fitRect(aspect, viewport, share = 0.84) {
  const maxW = viewport.width * share
  const maxH = viewport.height * share
  const width = Math.min(maxW, maxH * aspect)
  const height = width / aspect
  return { x: Math.round((viewport.width - width) / 2), y: Math.round((viewport.height - height) / 2), width: Math.round(width), height: Math.round(height) }
}
// The transform that puts the large picture over the small one (the start of opening, the end of closing).
export const flipFrom = (source, target) => `translate(${source.left - target.x}px, ${source.top - target.y}px) scale(${source.width / target.width}, ${source.height / target.height})`
export const nextZoom = (zoom, step) => {
  if (step > 0) return ZOOMS.find((value) => value > zoom + 0.001) ?? ZOOMS[ZOOMS.length - 1]
  return [...ZOOMS].reverse().find((value) => value < zoom - 0.001) ?? ZOOMS[0]
}

// (`instant`: it was already open — the detail drew it anew, a way being picked — so it's just there, not grown again.)
function PictureViewer({ open, items, active, onActive, onClose, sourceOf, render, instant = false }) {
  const [phase, setPhase] = useState('closed') // 'opening' | 'open' | 'closing' | 'closed'
  const [target, setTarget] = useState(null)
  const [start, setStart] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const stageRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)

  // Opening: measured from the thumbnail, then grown to the middle.
  useLayoutEffect(() => {
    if (!open || phase !== 'closed') return
    const source = sourceOf(active)
    const box = source?.getBoundingClientRect()
    returnTo.current = document.activeElement
    const aspect = box && box.height ? box.width / box.height : 4 / 3
    const to = fitRect(aspect, { width: window.innerWidth, height: window.innerHeight })
    setTarget(to)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    if (instant) { setStart(null); setPhase('open'); return }
    setStart(box && !reducedMotion() ? flipFrom(box, to) : null)
    setPhase('opening')
  }, [open, phase, active, sourceOf, instant])
  useEffect(() => {
    if (phase !== 'opening') return undefined
    // (Two frames: the picture is painted where the thumbnail is before it moves.)
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { setStart(null); setPhase('open'); closeRef.current?.focus({ preventScroll: true }) }) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [phase])

  // Closing: back to where the thumbnail is now (it may have moved), then gone.
  const close = () => {
    if (phase === 'closing' || phase === 'closed') return
    const box = sourceOf(active)?.getBoundingClientRect()
    setZoom(1)
    setPan({ x: 0, y: 0 })
    if (!box || !target || reducedMotion()) { finish(); return }
    setStart(flipFrom(box, target))
    setPhase('closing')
  }
  const finish = () => {
    setPhase('closed')
    setStart(null)
    onClose()
    const back = returnTo.current
    if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (phase !== 'closing') return undefined
    const timer = window.setTimeout(finish, DURATION + 40)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  // (Closed from outside — the detail gone: no animation to play.)
  if (!open && phase !== 'closed' && phase !== 'closing') setPhase('closed')

  // Esc; − / + / 0 from the keyboard.
  const keyRef = useRef(null)
  keyRef.current = (event) => {
    if (event.defaultPrevented) return
    // (Its Esc only: the detail under it doesn't close too.)
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close() }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom((value) => nextZoom(value, 1)) }
    else if (event.key === '-') { event.preventDefault(); setZoom((value) => nextZoom(value, -1)); setPan({ x: 0, y: 0 }) }
    else if (event.key === '0') { event.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }) }
  }
  useEffect(() => {
    if (phase === 'closed') return undefined
    const onKey = (event) => keyRef.current(event)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase])

  // The wheel and a pinch zoom it; the page behind never scrolls.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002))
      setZoom((value) => Math.min(2, Math.max(0.5, value * factor)))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [phase])

  // Bigger than the screen: dragged about.
  const pannable = target && (target.width * zoom > window.innerWidth || target.height * zoom > window.innerHeight)
  function startPan(event) {
    if (!pannable || event.button !== 0) return
    event.preventDefault()
    const from = { x: event.clientX, y: event.clientY, pan }
    setDragging(true)
    const onMove = (move) => setPan({ x: from.pan.x + move.clientX - from.x, y: from.pan.y + move.clientY - from.y })
    const onUp = () => { setDragging(false); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (phase === 'closed' || !target) return null
  const shown = phase === 'open'
  const moving = phase === 'opening' || phase === 'closing'
  // (Always from the top left — the growing from the thumbnail is computed that way — the zoom kept about the middle by a shift.)
  const transform = start ?? `translate(${pan.x + ((1 - zoom) * target.width) / 2}px, ${pan.y + ((1 - zoom) * target.height) / 2}px) scale(${zoom})`
  const CONTROL = 'flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-black/45 text-slate-200 backdrop-blur-sm transition-colors duration-150 hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40'

  return createPortal(
    <div data-picture-viewer role="dialog" aria-modal="true" aria-label={items.find((item) => item.id === active)?.label} className="fixed inset-0 z-[950]">
      {/* The canvas: dark, a little blurred, fading in as the picture grows — pressed, it closes. */}
      <div
        data-viewer-backdrop
        onClick={close}
        className="absolute inset-0 bg-black/[0.76] backdrop-blur-[3px]"
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${DURATION}ms ${EASE}` }}
      />
      {/* The picture: placed at its large place and size, moved from the thumbnail by transform alone. */}
      <div ref={stageRef} className="pointer-events-none absolute inset-0">
        <div
          data-viewer-picture={active}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={startPan}
          className={cn('pointer-events-auto absolute origin-top-left', pannable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default')}
          style={{
            left: target.x,
            top: target.y,
            width: target.width,
            height: target.height,
            transform,
            transformOrigin: 'top left',
            transition: dragging ? 'none' : `transform ${moving || !start ? DURATION : 0}ms ${EASE}`,
            willChange: moving ? 'transform' : undefined,
          }}
        >
          {/* Each picture in the same place, the one in view on top: switching cross-fades. */}
          {items.map((item) => (
            <div key={item.id} aria-hidden={item.id !== active} className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl" style={{ opacity: item.id === active ? 1 : 0, transition: 'opacity 180ms ease-out' }}>
              {render(item.id, target.width)}
            </div>
          ))}
        </div>
      </div>

      {/* The few controls, floating — they come in once the picture is in place. */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: shown ? 1 : 0, transition: 'opacity 160ms ease-out' }}>
        <button ref={closeRef} type="button" data-viewer-close aria-label="닫기" title="닫기 · Esc" onClick={close} className={cn(CONTROL, 'pointer-events-auto absolute top-4 left-4')}><X className="size-4" /></button>
        <nav aria-label="미리보기 전환" className="pointer-events-auto absolute top-1/2 left-4 flex -translate-y-1/2 flex-col gap-2">
          {items.map((item) => (
            <button key={item.id} type="button" data-viewer-thumb={item.id} aria-pressed={item.id === active} aria-label={item.label} title={item.label} onClick={() => { onActive(item.id); setZoom(1); setPan({ x: 0, y: 0 }) }}
              className={cn('flex w-[84px] flex-col items-center gap-1 rounded-lg p-1.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-emerald-300', item.id === active ? 'bg-white/[0.12] ring-2 ring-emerald-300' : 'bg-black/40 ring-1 ring-white/[0.08] hover:bg-white/[0.08]')}>
              <span className="pointer-events-none flex h-14 w-full items-center justify-center overflow-hidden rounded-md">{render(item.id, 72)}</span>
              <span className="w-full truncate text-center text-[10.5px] text-slate-300">{item.label}</span>
            </button>
          ))}
        </nav>
        <div role="toolbar" aria-label="확대" className="pointer-events-auto absolute right-4 bottom-4 flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/45 p-1 backdrop-blur-sm">
          <button type="button" data-viewer-zoom-out aria-label="축소" title="축소 · −" disabled={zoom <= ZOOMS[0]} onClick={() => { setZoom((value) => nextZoom(value, -1)); setPan({ x: 0, y: 0 }) }} className={cn(CONTROL, 'border-0 bg-transparent')}><Minus className="size-4" /></button>
          <span data-viewer-zoom className="w-12 text-center text-xs text-slate-300 tabular-nums">{Math.abs(zoom - 1) < 0.001 ? '맞춤' : `${Math.round(zoom * 100)}%`}</span>
          <button type="button" data-viewer-zoom-in aria-label="확대" title="확대 · +" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom((value) => nextZoom(value, 1))} className={cn(CONTROL, 'border-0 bg-transparent')}><Plus className="size-4" /></button>
          <button type="button" data-viewer-fit aria-label="화면에 맞춤" title="화면에 맞춤 · 0" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className={cn(CONTROL, 'border-0 bg-transparent')}><Scan className="size-4" /></button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// A picture in the detail that opens large: the drawing as it is, and — on hover or focus only — an
// expand button at its top right. The picture itself opens it too.
export function ExpandablePicture({ id, label, onOpen, children }) {
  return (
    <div data-zoom-picture={id} className="group/zoom relative grid h-full min-h-0 w-full items-center">
      <button type="button" data-picture-zoom aria-label={`${label} · 크게 보기`} aria-haspopup="dialog" onClick={() => onOpen(id)} className="ds-intrinsic grid h-full min-h-0 w-full cursor-zoom-in items-center overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
        {/* (Where it grows from: the drawing's own box.) */}
        <span data-zoom-source={id} className="mx-auto block w-full">{children}</span>
      </button>
      <button type="button" tabIndex={-1} aria-hidden data-picture-expand onClick={() => onOpen(id)}
        className="absolute top-0 right-0 flex size-8 cursor-zoom-in items-center justify-center rounded-lg border border-white/[0.08] bg-black/55 text-slate-100 opacity-0 backdrop-blur-sm transition-opacity duration-[160ms] ease-out group-focus-within/zoom:opacity-100 group-hover/zoom:opacity-100 hover:bg-black/70 motion-reduce:transition-none">
        <Maximize2 className="size-4" />
      </button>
    </div>
  )
}

export default PictureViewer
