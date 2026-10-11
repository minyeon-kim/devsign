import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { listStatusOf, shortDue } from '@/lib/conflicts'
import { PIN, anchorOf, layoutPins } from '@/lib/canvasPins'

// The change pins over the canvas (lib/canvasPins): a map-style pin whose
// tail points at the element a change is about. (No number on it: the list
// order still decides the order they're tabbed through.) They live in a
// layer of their own over the canvas —
// placed from where the elements are on screen, so they follow panning and
// zooming while staying one size.
// A pin is a button: its state is its color alone (amber; orange and larger
// when picked; grey with a check when the change is done). Pointing at one
// outlines its element and says what it is; picking one picks its element —
// the Conflict Points panel comes up below with the changes about it lit —
// rather than leaving for the detail.

const TOOLTIP_DELAY = 150
const HEAD_COLOR = { default: 'var(--color-amber-400)', selected: 'var(--color-orange-500)', resolved: 'var(--color-slate-500)' }

// A head with a tail under it, tip at the bottom center.
function PinShape({ head, height, color }) {
  const r = head / 2
  // The tail leaves the head's lower sides and meets at the tip.
  const spread = r * 0.62
  const from = r + Math.sqrt(r * r - spread * spread)
  return (
    // (Drawn 2px past the button's box on every side for its outline, and
    // offset by as much — so the tip is exactly at the box's bottom center.)
    <svg aria-hidden width={head + 4} height={height + 4} viewBox={`-2 -2 ${head + 4} ${height + 4}`} className="absolute overflow-visible" style={{ left: -2, top: -2 }}>
      {/* One outline: around the head, down its sides to the tip. */}
      <path d={`M ${r - spread} ${from} A ${r} ${r} 0 1 1 ${r + spread} ${from} L ${r} ${height} Z`} fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// Does the element show a box of its own — a fill, a border or a shadow on
// itself or on something that covers it?
function hasVisibleBox(element, box) {
  return [element, ...element.querySelectorAll('*')].some((node) => {
    const rect = node.getBoundingClientRect()
    if (Math.abs(rect.width - box.width) > 2 || Math.abs(rect.height - box.height) > 2) return false
    const style = getComputedStyle(node)
    const filled = !/rgba?\([^)]*,\s*0\)|transparent/.test(style.backgroundColor)
    return filled || parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== 'none'
  })
}
// Where the element's own content (its words) actually is, a little padded.
function contentRect(element) {
  // (Text node by text node: a block's own range is as wide as the block.)
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue
      left = Math.min(left, rect.left); top = Math.min(top, rect.top); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom)
    }
  }
  if (!Number.isFinite(left)) return null
  return { left: left - 3, top: top - 2, right: right + 3, bottom: bottom + 2 }
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
        const box = element.getBoundingClientRect()
        // An element that draws a box of its own (a card, a button, a field)
        // is pinned at that box. Text has no box to see — its layer is often
        // far wider than its words — so it's pinned where the words end.
        const boxed = hasVisibleBox(element, box)
        const words = boxed ? null : contentRect(element)
        const rect = words ?? box
        const artboard = element.closest('[data-canvas-frame]')?.getBoundingClientRect()
        // The element's own rounding, so its outline follows it.
        const rounded = [element, ...element.querySelectorAll('*')].map((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius)).find((value) => value > 0) ?? 0
        const scale = element.offsetWidth ? rect.width / element.offsetWidth : 1
        next.set(pin.id, {
          rect: { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top },
          frame: artboard ? { left: artboard.left - origin.left, right: artboard.right - origin.left } : null,
          radius: boxed ? rounded * scale : 4,
          // (On a box the tip goes 6px inside the corner; on text it touches
          // the end of the line instead of sitting on the letters.)
          inset: boxed ? PIN.inset : 0,
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
    pins.filter((pin) => boxes.has(pin.id)).map((pin) => ({ ...pin, ...anchorOf(boxes.get(pin.id).rect, boxes.get(pin.id).frame, { inset: boxes.get(pin.id).inset }) })),
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
              <span className="absolute inset-x-0 top-0 flex items-center justify-center text-[9px] font-semibold text-slate-950 tabular-nums" style={{ height: PIN.head }}>+{item.pins.length}</span>
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
            aria-label={`${translateText('Change point', language)}: ${translateText(conflict.title, language)}, ${translateText(listStatusOf(conflict).label, language)}`}
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
            {/* (No number on a pin: its color says its state, and a done one carries a check.) */}
            {pin.resolved && (
              <span className="absolute inset-x-0 top-0 flex items-center justify-center text-white" style={{ height: head }}>
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
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
