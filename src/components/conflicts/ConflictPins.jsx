import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { listStatusOf, shortDue } from '@/lib/conflicts'
import { PIN, anchorOf, layoutPins } from '@/lib/canvasPins'

// The change pins over the canvas (lib/canvasPins): a numbered, map-style
// pin whose tail points at the element a change is about, numbered like the
// "확인할 변경점" list. They live in a layer of their own over the canvas —
// placed from where the elements are on screen, so they follow panning and
// zooming while staying one size.
// A pin is a button: its state is its color alone (amber; orange and larger
// when picked; grey with a check when the change is done). Pointing at one
// outlines its element and says what it is; picking one picks it in the
// list and opens it.

const TOOLTIP_DELAY = 150
const HEAD_COLOR = { default: 'var(--color-amber-400)', selected: 'var(--color-orange-500)', resolved: 'var(--color-slate-500)' }

// A head with a tail under it, tip at the bottom center.
function PinShape({ head, height, color }) {
  const r = head / 2
  // The tail leaves the head's lower sides and meets at the tip.
  const spread = r * 0.62
  const from = r + Math.sqrt(r * r - spread * spread)
  return (
    <svg aria-hidden width={head + 4} height={height + 4} viewBox={`-2 -2 ${head + 4} ${height + 4}`} className="absolute top-0 left-0 overflow-visible" style={{ filter: 'drop-shadow(0 2px 6px rgb(0 0 0 / 0.35))' }}>
      <path d={`M ${r - spread} ${from} L ${r} ${height} L ${r + spread} ${from} Z`} fill={color} stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={r} cy={r} r={r} fill={color} stroke="white" strokeWidth="2" />
      {/* (Over the tail's own outline where it meets the head.) */}
      <path d={`M ${r - spread + 1.5} ${from - 1} L ${r} ${height - 3} L ${r + spread - 1.5} ${from - 1} Z`} fill={color} />
    </svg>
  )
}

function ConflictPins({ container, pins, conflicts, selection, hoverId, pulse, version, onHover, onSelect, onClear }) {
  const language = useLanguage()
  const [boxes, setBoxes] = useState(new Map())
  const [expanded, setExpanded] = useState(() => new Set())
  const [tip, setTip] = useState(null)
  const tipTimer = useRef(null)
  const byId = useMemo(() => new Map(conflicts.map((conflict) => [conflict.id, conflict])), [conflicts])

  // Where each pin's element is on screen, in the canvas viewport's own
  // coordinates — measured, so text edits, zoom and pan are all accounted for.
  useLayoutEffect(() => {
    if (!container) return
    let frame = 0
    const measure = () => {
      const origin = container.getBoundingClientRect()
      const next = new Map()
      for (const pin of pins) {
        const element = container.querySelector(`[data-layer-id="${CSS.escape(pin.layerId)}"]`)
        if (!element) continue
        const rect = element.getBoundingClientRect()
        const artboard = element.closest('[data-canvas-frame]')?.getBoundingClientRect()
        // The element's own rounding, so its outline follows it.
        const rounded = [element, ...element.querySelectorAll('*')].map((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius)).find((value) => value > 0) ?? 0
        const scale = element.offsetWidth ? rect.width / element.offsetWidth : 1
        next.set(pin.id, {
          rect: { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top },
          frame: artboard ? { left: artboard.left - origin.left, right: artboard.right - origin.left } : null,
          radius: rounded * scale,
        })
      }
      setBoxes((prev) => (JSON.stringify([...prev]) === JSON.stringify([...next]) ? prev : next))
    }
    measure()
    // (A glide to a pin moves the canvas for a moment after this runs.)
    const until = performance.now() + 400
    const follow = () => { measure(); if (performance.now() < until) frame = requestAnimationFrame(follow) }
    frame = requestAnimationFrame(follow)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [container, pins, version])

  // Escape lets go of the picked pin.
  useEffect(() => {
    if (!selection) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented && container?.contains(document.activeElement)) onClear() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, container, onClear])
  useEffect(() => () => window.clearTimeout(tipTimer.current), [])

  const isSelected = (pin) => selection?.conflictId === pin.conflictId && (selection.layerId ? selection.layerId === pin.layerId : pin.primary)
  const placed = layoutPins(
    pins.filter((pin) => boxes.has(pin.id)).map((pin) => ({ ...pin, ...anchorOf(boxes.get(pin.id).rect, boxes.get(pin.id).frame) })),
    { expanded }
  )
  const viewHeight = container?.clientHeight ?? 0
  const showTip = (key, data) => { window.clearTimeout(tipTimer.current); tipTimer.current = window.setTimeout(() => setTip({ key, ...data }), TOOLTIP_DELAY) }
  const hideTip = () => { window.clearTimeout(tipTimer.current); setTip(null) }
  const labelOf = (conflict) => [translateText(listStatusOf(conflict).label, language), shortDue(conflict.dueLabel) && translateText(shortDue(conflict.dueLabel), language)].filter(Boolean).join(' · ')

  return (
    <div data-conflict-pins className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* The element a pointed-at or picked change is about: an outline that
          follows its corners. Nothing else is dimmed. */}
      {pins.filter((pin) => boxes.has(pin.id) && (pin.conflictId === hoverId || pin.conflictId === selection?.conflictId)).map((pin) => {
        const { rect, radius } = boxes.get(pin.id)
        const picked = isSelected(pin)
        return (
          <span
            key={`outline:${pin.id}`}
            aria-hidden
            data-pin-outline={picked ? 'selected' : 'hover'}
            className="absolute"
            style={{
              left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, borderRadius: radius,
              border: picked ? '1.5px solid var(--color-orange-500)' : '1px solid color-mix(in srgb, var(--color-amber-400) 50%, transparent)',
              background: picked ? 'color-mix(in srgb, var(--color-orange-500) 8%, transparent)' : undefined,
            }}
          />
        )
      })}

      {placed.map((item) => {
        if (item.kind === 'cluster') {
          // Several at one spot: one pin saying how many; pressing it opens them out.
          return (
            <button
              key={item.key}
              type="button"
              data-pin-cluster={item.pins.length}
              aria-label={translateText(`${item.pins.length} changes here — show them`, language)}
              onClick={(event) => { event.stopPropagation(); setExpanded((prev) => new Set(prev).add(item.key)) }}
              className="ds-intrinsic ds-pin pointer-events-auto absolute cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              style={{ left: item.x - PIN.head / 2, top: item.y - PIN.height, width: PIN.head, height: PIN.height, zIndex: 2 }}
            >
              <PinShape head={PIN.head} height={PIN.height} color={HEAD_COLOR.default} />
              <span className="absolute inset-x-0 top-0 flex items-center justify-center text-[11px] font-semibold text-slate-950 tabular-nums" style={{ height: PIN.head }}>+{item.pins.length}</span>
            </button>
          )
        }
        const { pin } = item
        const conflict = byId.get(pin.conflictId)
        if (!conflict) return null
        const picked = isSelected(pin)
        const state = pin.resolved ? 'resolved' : picked ? 'selected' : 'default'
        const head = picked ? PIN.headSelected : PIN.head
        const height = picked ? PIN.heightSelected : PIN.height
        return (
          <button
            key={pin.id}
            type="button"
            data-pin={pin.id}
            data-pin-number={pin.number}
            data-pin-state={state}
            aria-pressed={picked}
            aria-label={`${translateText('Change point', language)} ${pin.number}: ${translateText(conflict.title, language)}, ${translateText(listStatusOf(conflict).label, language)}`}
            onClick={(event) => { event.stopPropagation(); hideTip(); onSelect(conflict, pin) }}
            onMouseEnter={() => { onHover(pin.conflictId); showTip(pin.id, { x: item.x, y: item.y - height, bottom: item.y, conflict }) }}
            onMouseLeave={() => { onHover(null); hideTip() }}
            onFocus={() => { onHover(pin.conflictId); showTip(pin.id, { x: item.x, y: item.y - height, bottom: item.y, conflict }) }}
            onBlur={() => { onHover(null); hideTip() }}
            className={cn('ds-intrinsic ds-pin pointer-events-auto absolute cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300', pin.resolved && 'opacity-70')}
            // (The tip stays where it points while the pin grows.)
            style={{ left: item.x - head / 2, top: item.y - height, width: head, height, zIndex: picked ? 4 : pin.conflictId === hoverId ? 3 : 1, transformOrigin: '50% 100%' }}
          >
            {/* Picked from the list: one ring of its own color, once. */}
            {picked && pulse > 0 && <span key={pulse} aria-hidden data-pin-pulse className="ds-pin-pulse absolute top-0 left-0 rounded-full" style={{ width: head, height: head, background: HEAD_COLOR.selected }} />}
            <PinShape head={head} height={height} color={HEAD_COLOR[state]} />
            <span className={cn('absolute inset-x-0 top-0 flex items-center justify-center text-xs font-semibold tabular-nums', state === 'selected' ? 'text-white' : state === 'resolved' ? 'text-white' : 'text-slate-950')} style={{ height: head }}>
              {pin.resolved ? <Check className="size-3" strokeWidth={3} /> : pin.number}
            </span>
          </button>
        )
      })}

      {/* What the pin under the pointer is: over it, or under it at the top edge. */}
      {tip && (() => {
        const below = tip.y < 56
        return (
          <div role="tooltip" data-pin-tooltip={below ? 'below' : 'above'} className="absolute z-10 w-max max-w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-popover px-2.5 py-1.5 shadow-lg" style={below ? { left: tip.x, top: Math.min(tip.bottom + 8, viewHeight - 48) } : { left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }}>
            <span className="block truncate text-xs font-medium text-slate-100"><LocalizedText text={tip.conflict.title} /></span>
            <span className="block truncate text-[11px] text-slate-400">{labelOf(tip.conflict)}</span>
            <span aria-hidden className={cn('absolute left-1/2 size-2 -translate-x-1/2 rotate-45 border-white/10 bg-popover', below ? '-top-1 border-t border-l' : '-bottom-1 border-r border-b')} />
          </div>
        )
      })()}
    </div>
  )
}

export default ConflictPins
