import { ChartColumn, ShieldCheck, Zap } from 'lucide-react'
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
const CARDS = [
  ['$12.4k', 'Revenue · +8%', ChartColumn],
  ['320', 'Orders · +12', Zap],
  ['8,210', 'Visitors · −3%', ShieldCheck],
  ['3.9%', 'Conversion · +0.4', ChartColumn],
]

const MARK = { outline: '3px solid rgb(251 191 36)', outlineOffset: 4, boxShadow: '0 0 0 9px rgb(251 191 36 / 22%)' }

export default function CodeRender({ spec, screen, scale = 1, marked = false, parts = [] }) {
  const mark = (part) => (parts.includes(part) ? { 'data-render-mark': part, style: MARK } : {})
  const layout = layoutAt(spec, screen)
  const viewport = screen
  const { columns, padding, gap, cardWidth, overlap, squeezed } = layout
  // Fixed-width cards that don't fit with their gap: pushed to the edges —
  // over each other, or with what's left of the gap between them.
  const overflowing = layout.tight
  return (
    <div data-code-render translate="no" data-viewport={viewport.id} data-width={viewport.width} data-height={viewport.height} data-breakpoint={layout.breakpoint} data-squeezed={squeezed ?? undefined} data-columns={columns} data-template={layout.template} data-overlap={overlap} className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80" style={{ width: viewport.width * scale, height: viewport.height * scale }}>
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
                borderColor: overlap > 0 ? 'rgb(244 63 94)' : squeezed != null ? 'rgb(245 158 11)' : 'rgb(226 232 240)',
                ...(parts.includes('cards') && MARK),
              }}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon className="size-4" /></span>
              <span className="text-[22px] leading-7 font-semibold tabular-nums">{value}</span>
              <span className="text-[13px] text-slate-500">{label}</span>
            </article>
          ))}
          {overlap > 0 && (
            <span data-render-overlap className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-3 py-1 text-[14px] font-bold whitespace-nowrap text-white shadow-lg">
              카드 겹침 {overlap}px
            </span>
          )}
          {squeezed != null && (
            <span data-render-squeezed className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 px-3 py-1 text-[14px] font-bold whitespace-nowrap text-white shadow-lg">
              간격 {squeezed}px (기준 {gap}px)
            </span>
          )}
        </section>
        <button type="button" tabIndex={-1} {...mark('cta')} className="pointer-events-none mt-6 h-12 w-full rounded-xl bg-blue-600 text-[15px] font-semibold text-white">Upgrade to Pro</button>
      </div>
    </div>
  )
}
