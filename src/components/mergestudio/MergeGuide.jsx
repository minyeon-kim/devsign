import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from 'cn'

// Merge Studio's onboarding: a five-step guide card that finds each step's
// target by `data-guide="…"` (Merge List, merge items, drift pager,
// Block Deck, Merge Changes), rings it, and sits beside it with an
// arrow. Each step lists its targets in order of preference — the first
// one present in the DOM wins (e.g. the Merge List toggle pill while the
// list is collapsed). With none present, the card rests top-center with
// the step's `fallback` copy. There's no Next: each step advances only on
// the user's own action (see MergeStudioWorkspace); Skip ends the guide.
export const GUIDE_STEPS = [
  {
    title: 'Explore the Merge List',
    body: 'Try a tab — Merges, Files, Layers — or narrow the list with the Status, Conflict and Due filters.',
    targets: [
      { id: 'merge-list', side: 'right', round: 'rounded-2xl' },
      { id: 'merge-list-toggle', side: 'bottom', round: 'rounded-full', body: 'Open the Merge List to browse merge items, switch tabs and filter by Status, Conflict or Due.' },
    ],
  },
  {
    title: 'Open a merge item',
    body: 'Click an item to open its comparison canvas — or use Add Files to Merge (under the search bar) to start one from your open files.',
    targets: [
      { id: 'merge-items', side: 'right', round: 'rounded-xl' },
      // On the Files / Layers tab the item list isn't mounted.
      { id: 'merge-list', side: 'right', round: 'rounded-2xl', body: 'Switch back to the Merges tab and click an item — or use Add Files to Merge to start one from your open files.' },
      { id: 'merge-list-toggle', side: 'bottom', round: 'rounded-full', body: 'Open the Merge List and click an item — or add your open files as a new one.' },
    ],
  },
  {
    title: 'Step through drifts',
    body: 'Click the drift counter’s ‹ › arrows to step from one visual change to the next.',
    targets: [
      { id: 'drift-nav', side: 'bottom', round: 'rounded-full' },
      { id: 'merge-cta', side: 'bottom', round: 'rounded-full', body: 'This item has a single drift — click any element on the canvas to inspect it.' },
    ],
  },
  {
    title: 'Edit & bind in the Block Deck',
    body: 'Inspect the drift here: keep Original or take Current for a property, or switch to Assemble to edit styles and bind design tokens.',
    // Anchored down in the drift list, so the card clears the pager /
    // Merge Changes row that runs across the top of the canvas.
    targets: [{ id: 'block-deck', side: 'left', round: 'rounded-2xl', anchor: 170 }],
    fallback: 'Click any element on the canvas to open the Block Deck, then review its properties and tokens there.',
  },
  {
    title: 'Finish the merge',
    body: 'When every drift is settled, click Merge Changes to complete the workflow.',
    targets: [{ id: 'merge-cta', side: 'bottom', round: 'rounded-full' }],
  },
]

const GAP = 14
const EDGE = 12
const CARD_W = 288

function findTarget(root, targets) {
  for (const t of targets) {
    const el = root.querySelector(`[data-guide="${t.id}"]`)
    if (!el || el.closest('[inert]')) continue
    const r = el.getBoundingClientRect()
    if (r.width && r.height) return { t, r }
  }
  return null
}

function sameLayout(a, b) {
  return a && b && a.key === b.key && ['x', 'y', 'ax', 'ay', 'hx', 'hy', 'hw', 'hh'].every((k) => Math.round(a[k]) === Math.round(b[k]))
}

function MergeGuide({ containerRef, step, onSkip }) {
  const cfg = GUIDE_STEPS[step - 1]
  const cardRef = useRef(null)
  const [layout, setLayout] = useState(null)

  // Targets move (panels slide, the deck drags, the canvas re-lays out), so
  // re-measure every frame while the guide is up; state only updates when
  // something actually moved.
  useLayoutEffect(() => {
    let raf
    function measure() {
      const root = containerRef.current
      const card = cardRef.current
      if (root && card) {
        const box = root.getBoundingClientRect()
        const cw = card.offsetWidth
        const ch = card.offsetHeight
        const hit = findTarget(root, cfg.targets)
        let next
        if (!hit) {
          next = { key: 'none', side: null, x: (box.width - cw) / 2, y: 60, ax: 0, ay: 0, hx: 0, hy: 0, hw: 0, hh: 0 }
        } else {
          const { t, r } = hit
          const tx = r.left - box.left
          const ty = r.top - box.top
          const clampX = (x) => Math.min(Math.max(EDGE, x), box.width - cw - EDGE)
          const clampY = (y) => Math.min(Math.max(EDGE, y), box.height - ch - EDGE)
          let x, y, ax, ay
          if (t.side === 'bottom') {
            x = clampX(tx + r.width / 2 - cw / 2)
            y = ty + r.height + GAP
            ax = tx + r.width / 2 - x - 6
            ay = -7
          } else {
            // Beside the target, arrow on its top 48px (a tall panel's
            // title bar, or the middle of a small button) unless the step
            // names its own `anchor` offset.
            const anchorY = ty + (t.anchor ?? Math.min(r.height, 48) / 2)
            x = t.side === 'right' ? tx + r.width + GAP : tx - GAP - cw
            y = clampY(anchorY - 24)
            ax = t.side === 'right' ? -7 : cw - 7
            ay = anchorY - y - 6
          }
          next = { key: `${step}:${t.id}`, side: t.side, x, y, ax, ay, hx: tx - 4, hy: ty - 4, hw: r.width + 8, hh: r.height + 8, round: t.round, body: t.body }
        }
        setLayout((prev) => (sameLayout(prev, next) ? prev : next))
      }
      raf = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(raf)
  }, [containerRef, cfg, step])

  const body = layout?.key === 'none' ? (cfg.fallback ?? cfg.body) : (layout?.body ?? cfg.body)

  return (
    <>
      {layout?.side && (
        <div
          aria-hidden
          className={cn('pointer-events-none absolute z-50 ring-2 ring-slate-200/70', layout.round)}
          style={{ left: layout.hx, top: layout.hy, width: layout.hw, height: layout.hh }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Guide step ${step} of ${GUIDE_STEPS.length}: ${cfg.title}`}
        className={cn(
          // Hidden (not faded) until the first measurement, so it never
          // flashes at the container's top-left corner.
          'absolute z-50 rounded-2xl border border-slate-300 bg-slate-100 p-4 text-slate-900 shadow-none',
          !layout && 'invisible'
        )}
        style={{ width: CARD_W, left: layout?.x ?? 0, top: layout?.y ?? 0 }}
      >
        {layout?.side && (
          <span
            aria-hidden
            className={cn(
              'absolute size-3 rotate-45 border-slate-300 bg-slate-100',
              layout.side === 'right' && 'border-b border-l',
              layout.side === 'left' && 'border-t border-r',
              layout.side === 'bottom' && 'border-t border-l'
            )}
            style={{ left: layout.ax, top: layout.ay }}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
            Step {step} of {GUIDE_STEPS.length}
          </span>
          <button type="button" onClick={onSkip} className="inline-flex items-center justify-center rounded-full px-2 h-5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800">
            Skip guide
          </button>
        </div>
        <p className="mt-1.5 text-sm font-semibold">{cfg.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1">
            {GUIDE_STEPS.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i + 1 === step ? 'w-4 bg-slate-700' : i + 1 < step ? 'w-1.5 bg-slate-500' : 'w-1.5 bg-slate-300')} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default MergeGuide
