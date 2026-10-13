import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { RISK_LABEL, listStatusOf, shortDue } from '@/lib/conflicts'
import { PIN, anchorOf, layoutPins, markerRect, markersOf } from '@/lib/canvasPins'

// The change pins over the canvas (lib/canvasPins): one map-style pin per
// change, its tail on the top-right corner of everything the change is about
// (all its elements together, or the group they're in). A change about
// several elements (four cards) says how many on the pin. They live in a
// layer of their own over the canvas — placed from where the elements are on
// screen, so they follow panning and zooming while staying one size.
// A pin is a button: its state is its color alone (amber; orange and larger
// when picked; grey with a check when the change is done). Pointing at one —
// or at its row in the list — outlines and tints every element it's about;
// otherwise no element is outlined. Picking one picks its element: the
// Conflict Points panel comes up below with the changes about it lit. Pins
// within 24px of each other become one cluster saying how many; pressing it
// lists them, and zooming in separates them again.

const TOOLTIP_DELAY = 150
const HEAD_COLOR = { default: 'var(--color-amber-400)', selected: 'var(--color-orange-500)', resolved: 'var(--color-slate-500)' }

// A head with a tail under it, tip at the bottom center.
// The same pin, standing for a count rather than one change — on a screen's
// card on the Screens board: its head, and the dark badge a pin carries for
// "more than one", here with the number of open changes ("99+" past 99).
export function ConflictCountPin({ label }) {
  return (
    <span data-count-pin className="relative block" style={{ width: PIN.head, height: PIN.height }}>
      <PinShape head={PIN.head} height={PIN.height} color={HEAD_COLOR.default} />
      <span data-pin-badge className="absolute flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] leading-none font-semibold text-white tabular-nums ring-1 ring-white" style={{ top: -6, left: PIN.head - 5 }}>{label}</span>
    </span>
  )
}

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

function ConflictPins({ container, pins, conflicts, selection, hoverId, version, onHover, onSelect, onClear }) {
  const language = useLanguage()
  const [boxes, setBoxes] = useState(new Map())
  const [openCluster, setOpenCluster] = useState(null)
  const [tip, setTip] = useState(null)
  const tipTimer = useRef(null)
  const byId = useMemo(() => new Map(conflicts.map((conflict) => [conflict.id, conflict])), [conflicts])

  // Where each pin's element is on screen, in the canvas viewport's own
  // coordinates — measured, so text edits, zoom and pan are all accounted for.
  const measure = useCallback(() => {
    if (!container) return
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
    // One box per change: all its elements together (or their group).
    for (const marker of markersOf(pins)) {
      const own = marker.pins.map((pin) => next.get(pin.id)).filter(Boolean)
      if (!own.length) continue
      let group = null
      if (own.length > 1) {
        const elements = marker.pins.map((pin) => container.querySelector(`[data-layer-id="${CSS.escape(pin.layerId)}"]`)).filter(Boolean)
        let host = elements[0]?.parentElement?.closest('[data-layer-id]')
        while (host && !elements.every((element) => host.contains(element))) host = host.parentElement?.closest('[data-layer-id]')
        if (host) { const box = host.getBoundingClientRect(); const origin2 = container.getBoundingClientRect(); group = { left: box.left - origin2.left, top: box.top - origin2.top, right: box.right - origin2.left, bottom: box.bottom - origin2.top } }
      }
      next.set(`marker:${marker.conflictId}`, { rect: markerRect(own.map((box) => box.rect), group), frame: own[0].frame, inset: own[0].inset })
    }
    setBoxes((prev) => (JSON.stringify([...prev]) === JSON.stringify([...next]) ? prev : next))
  }, [container, pins])
  // Measured in the same commit as whatever moved the element (a pan, a zoom,
  // an edit, an undo, a resize) — before the browser paints it — so a pin is
  // never a frame behind. (The boxes only become new state when they changed.)
  useLayoutEffect(() => { measure() })
  // The two things no commit announces: the canvas gliding to a pin (a CSS
  // transition on its transform — followed frame by frame while it runs) and
  // the viewport itself being resized.
  useEffect(() => {
    if (!container) return undefined
    let frame = 0
    const until = performance.now() + 400
    const follow = () => { measure(); if (performance.now() < until) frame = requestAnimationFrame(follow) }
    frame = requestAnimationFrame(follow)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [container, measure, version])

  // Escape lets go of the picked pin.
  useEffect(() => {
    if (!selection) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented && container?.contains(document.activeElement)) onClear() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, container, onClear])
  useEffect(() => () => window.clearTimeout(tipTimer.current), [])
  // The cluster's list closes on Escape or a press anywhere else.
  useEffect(() => {
    if (!openCluster) return undefined
    const close = (event) => { if (event.type === 'keydown' ? event.key === 'Escape' : !event.target.closest?.('[data-pin-cluster-list], [data-pin-cluster]')) setOpenCluster(null) }
    window.addEventListener('keydown', close)
    window.addEventListener('pointerdown', close)
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', close) }
  }, [openCluster])

  const isSelected = (marker) => selection?.conflictId === marker.conflictId
  const markers = markersOf(pins).filter((marker) => boxes.has(`marker:${marker.conflictId}`))
  const placed = layoutPins(
    markers.map((marker) => { const box = boxes.get(`marker:${marker.conflictId}`); return { ...marker, ...anchorOf(box.rect, box.frame, { inset: box.inset }) } })
  )
  const viewHeight = container?.clientHeight ?? 0
  const showTip = (key, data) => { window.clearTimeout(tipTimer.current); tipTimer.current = window.setTimeout(() => setTip({ key, ...data }), TOOLTIP_DELAY) }
  const hideTip = () => { window.clearTimeout(tipTimer.current); setTip(null) }
  // (Pointing at a pin says what kind of risk and how many — nothing opens.)
  const summaryOf = (conflict, count) => [translateText(`${RISK_LABEL[conflict.severity] ?? RISK_LABEL.medium} risk`, language), count].join(' · ')
  const labelOf = (conflict) => [translateText(listStatusOf(conflict).label, language), shortDue(conflict.dueLabel) && translateText(shortDue(conflict.dueLabel), language)].filter(Boolean).join(' · ')

  return (
    <div data-conflict-pins className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* Every element a pointed-at or picked change is about: an outline
          that follows its corners, and a light tint. Nothing else is outlined
          or dimmed. */}
      {pins.filter((pin) => boxes.has(pin.id) && (pin.conflictId === hoverId || pin.conflictId === selection?.conflictId)).map((pin) => {
        const { rect, radius } = boxes.get(pin.id)
        const picked = pin.conflictId === selection?.conflictId
        return (
          <span
            key={`outline:${pin.id}`}
            aria-hidden
            data-pin-outline={picked ? 'selected' : 'hover'}
            // (Picked — the change open beside the canvas: a heavier outline with a halo, so the element
            // reads at a glance from the detail; it comes in with a short zoom.)
            className={cn('absolute', picked && 'animate-in zoom-in-105 fade-in duration-300 motion-reduce:animate-none')}
            style={{
              left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, borderRadius: radius,
              border: picked ? '2px solid var(--color-orange-500)' : '1.5px solid color-mix(in srgb, var(--color-amber-400) 70%, transparent)',
              background: picked ? 'color-mix(in srgb, var(--color-orange-500) 12%, transparent)' : 'color-mix(in srgb, var(--color-amber-400) 12%, transparent)',
              boxShadow: picked ? '0 0 0 4px color-mix(in srgb, var(--color-orange-500) 28%, transparent), 0 0 24px 4px color-mix(in srgb, var(--color-orange-500) 30%, transparent)' : undefined,
            }}
          />
        )
      })}

      {placed.map((item) => {
        if (item.kind === 'cluster') {
          // Several changes at one spot: one pin saying how many; pressing it lists them.
          const open = openCluster === item.key
          return (
            <Fragment key={item.key}>
              <button
                type="button"
                data-pin-cluster={item.pins.length}
                aria-expanded={open}
                aria-label={translateText(`${item.pins.length} changes here — show them`, language)}
                onClick={(event) => { event.stopPropagation(); hideTip(); setOpenCluster(open ? null : item.key) }}
                className="ds-intrinsic ds-pin pointer-events-auto absolute cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                style={{ left: item.x - PIN.head / 2, top: item.y - PIN.height, width: PIN.head, height: PIN.height, zIndex: open ? 5 : 2 }}
              >
                <PinShape head={PIN.head} height={PIN.height} color={HEAD_COLOR.default} />
                <span className="absolute inset-x-0 top-0 flex items-center justify-center text-[9px] font-semibold text-slate-950 tabular-nums" style={{ height: PIN.head }}>{item.pins.length}</span>
              </button>
              {open && (
                <div data-pin-cluster-list role="menu" className="pointer-events-auto absolute z-10 w-max max-w-64 rounded-lg border border-white/10 bg-popover p-1 shadow-lg" style={{ left: item.x, top: item.y + 6, transform: 'translateX(-50%)' }}>
                  {item.pins.map((pin) => {
                    const conflict = byId.get(pin.conflictId)
                    if (!conflict) return null
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        role="menuitem"
                        data-pin-cluster-item={pin.conflictId}
                        onMouseEnter={() => onHover(pin.conflictId)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => onHover(pin.conflictId)}
                        onBlur={() => onHover(null)}
                        onClick={(event) => { event.stopPropagation(); setOpenCluster(null); onHover(null); onSelect(conflict, pin.pins[0]) }}
                        className="ds-intrinsic flex w-full min-w-0 cursor-pointer flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-emerald-300"
                      >
                        <span className="block max-w-full truncate text-xs font-medium text-slate-100"><LocalizedText text={conflict.title} /></span>
                        <span className="block max-w-full truncate text-[11px] text-slate-400">{labelOf(conflict)}{pin.count > 1 ? ` · ${pin.count}` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Fragment>
          )
        }
        const { pin: marker } = item
        const conflict = byId.get(marker.conflictId)
        if (!conflict) return null
        const picked = isSelected(marker)
        const state = marker.resolved ? 'resolved' : picked ? 'selected' : 'default'
        const head = picked ? PIN.headSelected : PIN.head
        const height = picked ? PIN.heightSelected : PIN.height
        return (
          <button
            key={marker.id}
            type="button"
            data-pin={marker.id}
            data-pin-number={marker.number}
            data-pin-count={marker.count}
            data-pin-state={state}
            aria-pressed={picked}
            aria-label={`${translateText('Change point', language)}: ${translateText(conflict.title, language)}, ${translateText(listStatusOf(conflict).label, language)}${marker.count > 1 ? ` · ${marker.count}` : ''}`}
            onClick={(event) => { event.stopPropagation(); hideTip(); onSelect(conflict, marker.pins[0]) }}
            onMouseEnter={() => { onHover(marker.conflictId); showTip(marker.id, { x: item.x, y: item.y - height, bottom: item.y, summary: summaryOf(conflict, marker.count) }) }}
            onMouseLeave={() => { onHover(null); hideTip() }}
            onFocus={() => { onHover(marker.conflictId); showTip(marker.id, { x: item.x, y: item.y - height, bottom: item.y, summary: summaryOf(conflict, marker.count) }) }}
            onBlur={() => { onHover(null); hideTip() }}
            className={cn('ds-intrinsic ds-pin pointer-events-auto absolute cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300', marker.resolved && 'opacity-70')}
            // (The tip stays where it points while the pin grows.)
            style={{ left: item.x - head / 2, top: item.y - height, width: head, height, zIndex: picked ? 4 : marker.conflictId === hoverId ? 3 : 1, transformOrigin: '50% 100%' }}
          >
            <PinShape head={head} height={height} color={HEAD_COLOR[state]} />
            {/* (A done one carries a check.) */}
            {marker.resolved && (
              <span className="absolute inset-x-0 top-0 flex items-center justify-center text-white" style={{ height: head }}>
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
            {/* How many elements the change is about — only when it's more than one. */}
            {marker.count > 1 && (
              <span data-pin-badge className="absolute flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] leading-none font-semibold text-white tabular-nums ring-1 ring-white" style={{ top: -6, right: -9 }}>{marker.count}</span>
            )}
          </button>
        )
      })}

      {/* What the pin under the pointer is: over it, or under it at the top edge. */}
      {tip && (() => {
        const below = tip.y < 56
        return (
          <div role="tooltip" data-pin-tooltip={below ? 'below' : 'above'} className="absolute z-10 w-max max-w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-popover px-2.5 py-1.5 shadow-lg" style={below ? { left: tip.x, top: Math.min(tip.bottom + 8, viewHeight - 48) } : { left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }}>
            <span className="block truncate text-xs font-medium text-slate-100">{tip.summary}</span>
            <span aria-hidden className={cn('absolute left-1/2 size-2 -translate-x-1/2 rotate-45 border-white/10 bg-popover', below ? '-top-1 border-t border-l' : '-bottom-1 border-r border-b')} />
          </div>
        )
      })()}
    </div>
  )
}

export default ConflictPins
