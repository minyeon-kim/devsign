import { cn } from 'cn'

// A spacing change, drawn for a notification's small picture: the legend
// alone — not the chart it sits under — as it lays out in a narrow (320px)
// card, enlarged, in the dark theme the panel is in, with the gap it's about
// measured the way a design tool marks a distance: a thin pink line across
// it and the number over it.
//
// It is drawn live (a few spans), not kept as an image: it sits on the panel's
// own surface with no frame of its own, and it's sharp at any size.
//   gap: px between the legend's items (4 as built, 8 as designed)
export const LEGEND_WIDTH = 320
const ITEMS = [['Revenue', '#818cf8'], ['Orders', '#34d399'], ['Visitors', '#fbbf24'], ['Refunds', '#fb7185'], ['Sessions', '#38bdf8'], ['Signups', '#c084fc']]
// (Enlarged so its labels read at the picture's size — about twice the size the whole chart's legend was drawn at.)
const ZOOM = 0.92

export function LegendRedline({ gap, className }) {
  return (
    <span data-legend-redline={gap} className={cn('pointer-events-none absolute inset-0 block overflow-hidden', className)} style={{ maskImage: 'linear-gradient(to right, black 82%, transparent)' }}>
      {/* The legend at its real width, wrapping where it must; only its left part fits the picture. */}
      <span className="absolute top-1/2 left-3 flex origin-left flex-wrap content-start" translate="no" style={{ width: LEGEND_WIDTH, gap, transform: `translateY(-50%) scale(${ZOOM})` }}>
        {ITEMS.map(([label, color], index) => (
          <span key={label} data-legend-item className="relative flex h-4 items-center gap-1 text-[12px] leading-4 font-medium text-slate-200">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
            {label}
            {/* The distance to the next item, marked once — between the first two. */}
            {index === 0 && (
              <span aria-hidden data-redline className="absolute top-0 left-full h-full" style={{ width: gap }}>
                <span className="absolute top-0.5 bottom-0.5 left-0 w-px bg-pink-500" />
                <span className="absolute top-0.5 right-0 bottom-0.5 w-px bg-pink-500" />
                <span className="absolute top-1/2 right-0 left-0 h-px bg-pink-500" />
                <span data-redline-value className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 rounded-[3px] bg-pink-500 px-1 text-[9px] leading-3 font-semibold text-white tabular-nums">{gap}</span>
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  )
}

// Whether a change is drawn this way, and with which gaps: { before, after } in px — or null.
export function legendGapsOf(conflict) {
  if (conflict?.sample !== 'legend') return null
  const before = Number.parseFloat(conflict.preview?.before?.gap)
  const after = Number.parseFloat(conflict.preview?.after?.gap)
  return Number.isFinite(before) && Number.isFinite(after) ? { before, after } : null
}
