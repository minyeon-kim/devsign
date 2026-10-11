import { ChartColumn, ShieldCheck, Zap } from 'lucide-react'
import { cn } from 'cn'
import { layoutAt } from '@/lib/codeRender'

// A checkpoint's code on a screen: the dashboard as its DashboardGrid lays it
// out at a viewport (lib/codeRender), drawn at that viewport's real size and
// scaled to the room there is. Cards the code makes wider than their column
// are drawn that wide — over their neighbours — and say by how much.
// `marked`: what this checkpoint changed against the one before it (the card
// grid) ringed. `parts`: the parts a conflict is about ('cards', 'cta',
// 'title', 'subtitle') ringed too. A mark is an outline on the element
// itself, inside the scaled screen — never a stored position — so it's on
// its element at any viewport, zoom or size, full screen included.
// `inspect` (History's comparison): the screen is drawn clean — no red
// borders, no pill over the content — and `inspect` lists what to mark
// (lib/codeRender's inspectionsFor): one hatched area per problem, exactly
// where it is. Its label is the caller's to draw, outside the frame.
// `emphasis`: the id of the mark to draw stronger (its label is hovered).
const CARDS = [
  ['$12.4k', 'Revenue · +8%', ChartColumn],
  ['320', 'Orders · +12', Zap],
  ['8,210', 'Visitors · −3%', ShieldCheck],
  ['3.9%', 'Conversion · +0.4', ChartColumn],
]

// An inspection mark's colors: a 1px line and a faint fill, from the app's
// own danger / warning / info colors — the content under it stays readable.
export const INSPECT_TONE = {
  danger: { line: 'var(--destructive)', fill: 'color-mix(in oklab, var(--destructive) 16%, transparent)' },
  warning: { line: '#fcd34d', fill: 'color-mix(in oklab, #fcd34d 14%, transparent)' },
  info: { line: '#7dd3fc', fill: 'transparent' },
}

const MARK = { outline: '3px solid rgb(251 191 36)', outlineOffset: 4, boxShadow: '0 0 0 9px rgb(251 191 36 / 22%)' }

// `crop`: stop at the end of the content (or at a height given, so two
// renders compared are the same size) instead of drawing the whole (tall)
// screen — for comparing layouts at a readable size.
export default function CodeRender({ spec, screen, scale = 1, marked = false, parts = [], crop = false, className, inspect = null, emphasis = null }) {
  const mark = (part) => (parts.includes(part) ? { 'data-render-mark': part, style: MARK } : {})
  const layout = layoutAt(spec, screen)
  const viewport = crop ? { ...screen, height: Math.min(screen.height, typeof crop === 'number' ? crop : layout.contentHeight) } : screen
  const { columns, padding, gap, cardWidth, overlap, squeezed } = layout
  // Fixed-width cards that don't fit with their gap: pushed to the edges —
  // over each other, or with what's left of the gap between them.
  const overflowing = layout.tight
  return (
    <div data-code-render translate="no" data-viewport={viewport.id} data-width={viewport.width} data-height={viewport.height} data-breakpoint={layout.breakpoint} data-squeezed={squeezed ?? undefined} data-columns={columns} data-template={layout.template} data-overlap={overlap} className={cn('relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80', className)} style={{ width: viewport.width * scale, height: viewport.height * scale }}>
      <div className="absolute top-0 left-0 origin-top-left overflow-hidden bg-slate-50 text-slate-900" style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})`, padding }}>
        <p className="w-fit rounded-md text-[28px] leading-9 font-bold tracking-tight" {...mark('title')}>Dashboard</p>
        <p className="mt-1 w-fit rounded-md text-[14px] text-slate-500" {...mark('subtitle')}>Good morning, Sam · This week</p>
        <section
          data-render-grid
          data-render-mark={marked ? 'grid' : undefined}
          className="relative mt-6 grid"
          style={{
            // (Fixed-width cards that don't fit: the grid stays the screen's
            // width — its columns share it — and each card keeps its own.)
            gridTemplateColumns: overflowing ? `repeat(${columns}, minmax(0, 1fr))` : layout.template,
            // (Both set, never the shorthand: going between a tight layout and
            // a fitting one would otherwise leave the column gap cleared.)
            rowGap: gap,
            columnGap: overflowing ? 0 : gap,
            ...(marked && { ...MARK, outlineOffset: 8, borderRadius: 12 }),
          }}
        >
          {CARDS.map(([value, label, Icon], index) => (
            <article
              key={label}
              data-render-card
              data-render-mark={parts.includes('cards') ? 'cards' : undefined}
              className="relative flex h-[132px] flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm"
              style={{
                ...(overflowing && { width: cardWidth, zIndex: index + 1, background: 'rgb(255 255 255 / 86%)', justifySelf: index % columns === 0 ? 'start' : index % columns === columns - 1 ? 'end' : 'center' }),
                borderColor: inspect ? 'rgb(226 232 240)' : overlap > 0 ? 'rgb(244 63 94)' : squeezed != null ? 'rgb(245 158 11)' : 'rgb(226 232 240)',
                ...(parts.includes('cards') && MARK),
              }}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon className="size-4" /></span>
              <span className="text-[22px] leading-7 font-semibold tabular-nums">{value}</span>
              <span className="text-[13px] text-slate-500">{label}</span>
            </article>
          ))}
          {!inspect && overlap > 0 && (
            <span data-render-overlap className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-3 py-1 text-[14px] font-bold whitespace-nowrap text-white shadow-lg">
              카드 겹침 {overlap}px
            </span>
          )}
          {!inspect && squeezed != null && (
            <span data-render-squeezed className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 px-3 py-1 text-[14px] font-bold whitespace-nowrap text-white shadow-lg">
              간격 {squeezed}px (기준 {gap}px)
            </span>
          )}
        </section>
        {/* What's inspected, where it is: a hatched strip (or, for a
            difference with no problem behind it, a thin outline) — in the
            screen's own px, so it scales with the screen. */}
        {(inspect ?? []).map((item) => {
          const tone = INSPECT_TONE[item.tone] ?? INSPECT_TONE.info
          const strong = emphasis === item.id
          return (
            <span
              key={item.id}
              aria-hidden
              data-inspect-region={item.id}
              className="pointer-events-none absolute z-20"
              style={{
                left: item.region.x, top: item.region.y, width: item.region.width, height: item.region.height,
                border: `${Math.max(1, 1 / scale)}px ${item.outline ? 'dashed' : 'solid'} ${tone.line}`,
                borderRadius: item.outline ? 12 : 2,
                background: item.outline ? 'transparent' : `repeating-linear-gradient(135deg, ${tone.line} 0 ${1 / scale}px, ${tone.fill} ${1 / scale}px ${5 / scale}px)`,
                opacity: item.outline ? 1 : strong ? 0.95 : 0.6,
              }}
            />
          )
        })}
        <button type="button" tabIndex={-1} {...mark('cta')} className="pointer-events-none mt-6 h-12 w-full rounded-xl bg-blue-600 text-[15px] font-semibold text-white">Upgrade to Pro</button>
      </div>
    </div>
  )
}
