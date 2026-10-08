import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Trash2, Type } from 'lucide-react'
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
    // (The scaled screen inside the box — under a device frame's scroller
    // when there is one.)
    const innerEl = box?.querySelector('[data-frame-content]') ?? box?.firstElementChild
    const el = box?.querySelector(`[data-layer-id="${CSS.escape(layerId)}"]`)
    if (!box || !innerEl || !el) return []
    const clip = box.getBoundingClientRect()
    const inner = innerEl.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!inner.width || !r.width) return []
    const k = inner.width / frame.width
    return [{
      key, clip, inner, k, rect: r, look: readStyle(el),
      geom: { x: (r.left - inner.left) / k, y: (r.top - inner.top) / k, w: r.width / k, h: r.height / k },
    }]
  })
}

// One number of the element's geometry, typed: Enter or leaving the field
// applies it, Esc puts it back, ↑ / ↓ step it (⇧ by 10).
function GeomField({ name, label, value, onCommit }) {
  const [draft, setDraft] = useState(null)
  const shown = draft ?? String(value)
  function commit() {
    if (draft == null) return
    const next = Number(draft)
    setDraft(null)
    if (Number.isFinite(next) && next !== value) onCommit(next)
  }
  return (
    <label className="flex items-center gap-0.5 rounded-md px-1 text-[10.5px] text-slate-400 focus-within:bg-white/[0.08]" title={label}>
      <span className="font-semibold">{label}</span>
      <input
        data-geom-field={name}
        inputMode="numeric"
        value={shown}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.-]/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') { commit(); event.currentTarget.blur() }
          else if (event.key === 'Escape') { setDraft(null); event.currentTarget.blur() }
          else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
            setDraft(null)
            onCommit((Number(shown) || 0) + step)
          }
        }}
        className="w-9 bg-transparent text-[11px] text-slate-100 tabular-nums outline-none"
      />
    </label>
  )
}

// The design system's colors, offered first; the native picker covers the
// rest. `null` puts the element's own color back.
const SWATCHES = [
  ['#7c3aed', 'Violet 600'], ['#ede9fe', 'Violet 100'], ['#0f172a', 'Slate 900'], ['#64748b', 'Slate 500'],
  ['#ffffff', 'White'], ['#10b981', 'Emerald 500'], ['#f43f5e', 'Rose 500'], ['#f59e0b', 'Amber 500'],
]

// Any CSS color (Tailwind's are oklch) as #rrggbb, by painting one pixel;
// null when transparent.
let probe
const hexCache = new Map()
function toHex(color) {
  if (!color) return null
  if (hexCache.has(color)) return hexCache.get(color)
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  const hex = a < 8 ? null : `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  hexCache.set(color, hex)
  return hex
}

// What the element looks like now, read off the rendered element: its fill,
// its text color, and its main piece of text (the slot it lives in).
function readStyle(el) {
  const body = el?.firstElementChild
  const textEl = el?.querySelector('[data-text]')
  return {
    fill: body ? toHex(getComputedStyle(body).backgroundColor) : null,
    text: textEl ? toHex(getComputedStyle(textEl).color) : body ? toHex(getComputedStyle(body).color) : null,
    slot: textEl?.dataset.text ?? null,
    copy: textEl?.textContent ?? '',
  }
}

function ColorRow({ name, value, onPick }) {
  return (
    <div data-style-colors={name} className="flex items-center gap-1">
      {SWATCHES.map(([hex, label]) => (
        <button
          key={hex}
          type="button"
          title={label}
          data-swatch={hex}
          onClick={() => onPick(hex)}
          className={`ds-intrinsic size-4 rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 ${value === hex ? 'outline-2 outline-offset-1 outline-emerald-400' : ''}`}
          style={{ background: hex }}
        />
      ))}
      <label title="Custom" className="relative size-4 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(#f43f5e,#f59e0b,#10b981,#3b82f6,#7c3aed,#f43f5e)] ring-1 ring-white/20">
        <input type="color" value={value ?? '#7c3aed'} onChange={(event) => onPick(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
      <button type="button" title="Original" data-swatch-reset onClick={() => onPick(null)} className="rounded-full px-1.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-100">
        <RotateCcw className="size-3" />
      </button>
    </div>
  )
}

function CopyField({ value, onCommit }) {
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)
  return (
    <input
      data-style-copy
      autoFocus
      value={draft}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      // (Emptied, it goes back to the element's own text.)
      onBlur={() => {
        if (cancelled.current) cancelled.current = false
        else if (draft !== value) onCommit(draft.trim() ? draft : null)
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') event.currentTarget.blur()
        else if (event.key === 'Escape') { cancelled.current = true; setDraft(value); event.currentTarget.blur() }
      }}
      className="w-52 bg-transparent px-1.5 text-[11px] text-slate-100 outline-none"
    />
  )
}

function LayerTransformHandles({ layerId, frame, boards, onChange, onDelete, onReset, onStyle, dock }) {
  const [found, setFound] = useState([])
  // The pane's dock (a selector) the toolbar sits in, clear of the screen.
  const [dockEl, setDockEl] = useState(null)
  useLayoutEffect(() => setDockEl(dock ? document.querySelector(dock) : null), [dock])
  // The toolbar's open row: 'fill' / 'text' colors, or 'copy'.
  const [panel, setPanel] = useState(null)
  useEffect(() => setPanel(null), [layerId])
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
      const sig = next.map((b) => [b.rect.left, b.rect.top, b.rect.width, b.rect.height, b.clip.left, b.clip.top, b.clip.width, b.clip.height].map(Math.round).join(',') + JSON.stringify(b.look)).join('|')
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

  // Arrow keys nudge in frame pixels, independent of canvas zoom.
  useEffect(() => {
    function nudge(event) {
      if (isTyping() || event.metaKey || event.ctrlKey || event.altKey || drag.current) return
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!delta || event.target?.closest?.('button, select, [role="dialog"]')) return
      const board = measureBoards(boards, layerId, frame)[0]
      if (!board) return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      onChange({ ...board.geom, x: board.geom.x + delta[0] * step, y: board.geom.y + delta[1] * step })
    }
    window.addEventListener('keydown', nudge)
    return () => window.removeEventListener('keydown', nudge)
  }, [boards, layerId, frame, onChange])

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

  // The element's position and size as numbers, to type exactly (frame
  // pixels), its fill / text color / text, and reset / delete — above the
  // element, or in the pane's dock when there is one (`dock`).
  function toolbar(board, place) {
    const look = onStyle ? board.look : null
    return (
      <div data-geom-toolbar className={`pointer-events-auto ${place} flex h-7 items-center gap-0.5 rounded-full border border-white/10 bg-card/95 px-1 whitespace-nowrap shadow-lg backdrop-blur-md`}>
        {[['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H']].map(([key, label]) => (
          <GeomField
            key={key}
            name={key}
            label={label}
            value={Math.round(board.geom[key])}
            onCommit={(next) => {
              const geom = { ...board.geom, [key]: next }
              onChange({
                x: Math.round(Math.max(0, geom.x)),
                y: Math.round(Math.max(0, geom.y)),
                w: Math.round(Math.max(MIN, geom.w)),
                h: Math.round(Math.max(MIN, geom.h)),
              })
            }}
          />
        ))}
        {/* Fill, text color and the text itself. */}
        {look && (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            <button
              type="button"
              title="Fill"
              data-style-toggle="fill"
              aria-pressed={panel === 'fill'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPanel((p) => (p === 'fill' ? null : 'fill'))}
              className={`ds-intrinsic flex size-5 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${panel === 'fill' ? 'bg-white/10' : ''}`}
            >
              <span className="size-3 rounded-full ring-1 ring-white/30" style={{ background: look.fill ?? 'transparent' }} />
            </button>
            <button
              type="button"
              title="Text color"
              data-style-toggle="text"
              aria-pressed={panel === 'text'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPanel((p) => (p === 'text' ? null : 'text'))}
              className={`ds-intrinsic flex size-5 flex-col items-center justify-center rounded-full text-[11px] leading-none font-bold text-slate-100 transition-colors hover:bg-white/10 ${panel === 'text' ? 'bg-white/10' : ''}`}
            >
              A
              <span className="mt-px h-[2px] w-2.5 rounded-full" style={{ background: look.text ?? '#94a3b8' }} />
            </button>
            {look.slot && (
              <button
                type="button"
                title="Text"
                data-style-toggle="copy"
                aria-pressed={panel === 'copy'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setPanel((p) => (p === 'copy' ? null : 'copy'))}
                className={`ds-intrinsic flex size-5 items-center justify-center rounded-full text-slate-100 transition-colors hover:bg-white/10 ${panel === 'copy' ? 'bg-white/10' : ''}`}
              >
                <Type className="size-3" />
              </button>
            )}
          </>
        )}
        {(onReset || onDelete) && <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />}
        {onReset && (
          <button
            type="button"
            title="Reset edits"
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
        {look && panel && (
          <div
            data-style-panel={panel}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-full left-0 mb-1.5 flex h-7 items-center rounded-full border border-white/10 bg-card/95 px-1.5 shadow-lg backdrop-blur-md"
          >
            {panel === 'fill' && <ColorRow name="fill" value={look.fill} onPick={(hex) => onStyle({ fillColor: hex })} />}
            {panel === 'text' && <ColorRow name="text" value={look.text} onPick={(hex) => onStyle({ textColor: hex })} />}
            {panel === 'copy' && look.slot && (
              <CopyField key={`${layerId}:${look.slot}`} value={look.copy} onCommit={(text) => onStyle({ copy: { [look.slot]: text } })} />
            )}
          </div>
        )}
      </div>
    )
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
              {!dockEl && toolbar(board, 'absolute bottom-full left-0 mb-2')}
            </div>
          </div>
        )
      })}
      {dockEl && found[0] && createPortal(toolbar(found[0], 'relative'), dockEl)}
    </div>
  )
}

export default LayerTransformHandles
