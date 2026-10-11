import { ALL_DEVICES, breakpointOf, screenOf } from '@/lib/devicePresets'

// What a checkpoint's code renders — read from the code itself.
//
// History's preview used to draw the design prototype's frame for every
// checkpoint (with a few values derived from code, for one project): moving
// through a project's history showed the same screen each time. A code
// renderer reads the checkpoint's own file and says what it lays out, per
// viewport, so the preview is that checkpoint's code on a screen of that
// width.
//
// This prototype doesn't run the project's TSX. A renderer is written per
// file it can read (`CODE_RENDERERS`); a checkpoint whose file has none, or
// whose code it can't read, says so (`renderOf` → `{ error }`) — the preview
// then shows the design prototype *labelled as that*, never in its place
// unsaid.

// (The screens it's looked at on — devices, breakpoints — are lib/devicePresets'.)
// "repeat(2, 360px)" → { count: 2, track: '360px', fixed: 360 }; "minmax(0, 1fr)" → one fluid column.
export function parseTemplate(template) {
  const text = String(template ?? '').trim()
  const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(text)
  const count = repeat ? Number(repeat[1]) : 1
  const track = (repeat ? repeat[2] : text).trim()
  const fixed = /^(\d+(?:\.\d+)?)px$/.exec(track)
  return { template: text, count, track, fixed: fixed ? Number(fixed[1]) : null }
}

// The dashboard's grid (DashboardGrid.tsx): which columns the code asks for
// at the tablet breakpoint (768px — `useBreakpoint() === "tablet"`) and
// everywhere else.
function parseDashboardGrid(lines) {
  const text = lines.join('\n')
  const branch = /tablet\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/.exec(text)
  if (branch) return { component: 'dashboard-grid', tablet: branch[1], base: branch[2] }
  const single = /gridTemplateColumns:\s*"([^"]+)"/.exec(text)
  return single ? { component: 'dashboard-grid', tablet: single[1], base: single[1] } : null
}

// Which part of the rendered dashboard a design layer is (the render has no
// layers of its own): what a conflict about that layer marks on it.
const dashboardPartOf = (layerId) => (/--cards--/.test(layerId) ? 'cards' : /--cta--/.test(layerId) ? 'cta' : /--h-title$/.test(layerId) ? 'title' : /--h-sub$/.test(layerId) ? 'subtitle' : null)

const CODE_RENDERERS = {
  'dashboard-redesign:app': { parse: parseDashboardGrid, partOf: dashboardPartOf, file: 'src/components/dashboard/DashboardGrid.tsx', category: 'tablet' },
}

// The parts of the render a conflict's elements are — marked at every
// viewport (a card's padding is the card's on any screen).
export function renderPartsOf(projectId, fileId, layerIds = []) {
  const partOf = CODE_RENDERERS[`${projectId}:${fileId}`]?.partOf
  return partOf ? [...new Set(layerIds.map(partOf).filter(Boolean))] : []
}

export const hasCodeRenderer = (projectId, fileId) => Boolean(CODE_RENDERERS[`${projectId}:${fileId}`])
// The kind of device a file's layout is about (its reference device is where its render starts).
export const categoryFor = (projectId, fileId) => CODE_RENDERERS[`${projectId}:${fileId}`]?.category ?? 'tablet'

// `{ spec, file }` for a checkpoint's code, `{ error }` when it has a
// renderer that can't read it, null when its file has no renderer at all.
export function renderOf(projectId, fileId, lines) {
  const renderer = CODE_RENDERERS[`${projectId}:${fileId}`]
  if (!renderer) return null
  if (!Array.isArray(lines) || !lines.length) return { error: 'This checkpoint has no code snapshot to render.' }
  const spec = renderer.parse(lines)
  return spec ? { spec, file: renderer.file } : { error: 'This checkpoint’s code couldn’t be read into a layout.' }
}

// The grid as a screen lays it out (`screen`: lib/devicePresets' screenOf —
// its width decides the breakpoint, so the tablet rule applies from 768 up
// to 1024 and nowhere else). When the code asks for fixed-width cards:
//   · they fit → drawn as asked;
//   · they'd fit without the gap → `squeezed`: the gap that's left;
//   · they don't fit at all → `overlap`: how far each runs over the next
//     (the first card sits at the left edge, the last at the right:
//     2 × 360px in 704px → 16px).
export const CARD_COUNT = 4
export const CARD_HEIGHT = 132
export function layoutAt(spec, screen) {
  const breakpoint = breakpointOf(screen.width)
  const template = breakpoint === 'tablet' ? spec.tablet : spec.base
  const parsed = parseTemplate(template)
  const padding = breakpoint === 'mobile' ? 16 : 32
  const gap = breakpoint === 'mobile' ? 12 : 24
  const available = screen.width - padding * 2
  const cards = parsed.fixed ? parsed.fixed * parsed.count : 0
  const tight = Boolean(parsed.fixed) && parsed.count > 1 && cards + gap * (parsed.count - 1) > available
  const overlap = tight && cards > available ? Math.round((cards - available) / (parsed.count - 1)) : 0
  const squeezed = tight && !overlap ? Math.round((available - cards) / (parsed.count - 1)) : null
  // How tall the screen's content is (title, the card rows, the button):
  // a render can stop there rather than draw the empty rest of a tall screen.
  const rows = Math.ceil(CARD_COUNT / parsed.count)
  const contentHeight = padding + 36 + 4 + 20 + 24 + rows * CARD_HEIGHT + (rows - 1) * gap + 24 + 48 + padding
  // Where the card grid sits on the screen (under the title and its line).
  const grid = { x: padding, y: padding + 36 + 4 + 20 + 24, width: available, height: rows * CARD_HEIGHT + (rows - 1) * gap }
  return { breakpoint, template: parsed.template, columns: parsed.count, padding, gap, cardWidth: parsed.fixed, tight, overlap, squeezed, contentHeight, grid }
}

// Whether two checkpoints lay the screen out differently on a screen.
export function layoutChanged(spec, previous, screen) {
  if (!spec || !previous) return false
  return layoutAt(spec, screen).template !== layoutAt(previous, screen).template
}

// The preset devices (upright) on which they do — where to look for a
// change that leaves this screen as it was (a tablet-only rule changes
// nothing on a phone). Devices of `category` first.
export function screensChanged(spec, previous, category = 'tablet') {
  if (!spec || !previous) return []
  return [...ALL_DEVICES].sort((a, b) => (b.category === category) - (a.category === category) || (b.id === 'ipad-classic') - (a.id === 'ipad-classic'))
    .map((device) => screenOf({ deviceId: device.id }, category)).filter((screen) => layoutChanged(spec, previous, screen))
}

// A code change in a person's words: how two versions lay the cards out on a
// screen — "태블릿(768px)에서 카드 열 너비: 360px 고정 → 화면에 맞춰 늘어남". Null
// when they lay it out the same there.
const BREAKPOINT_KO = { mobile: '모바일', tablet: '태블릿', desktop: '데스크톱' }
const trackWords = (layout) => (layout.cardWidth ? `${layout.cardWidth}px 고정` : '화면에 맞춰 늘어남')
// `effects: false`: the change alone — a problem it causes or clears (an
// overlap) is said apart, as a problem.
export function layoutDelta(from, to, screen, { effects = true } = {}) {
  if (!from || !to || !layoutChanged(from, to, screen)) return null
  const a = layoutAt(from, screen)
  const b = layoutAt(to, screen)
  const where = `${BREAKPOINT_KO[a.breakpoint]}(${screen.width}px)에서`
  const parts = []
  if (a.columns !== b.columns) parts.push(`카드 열 수: ${a.columns}열 → ${b.columns}열`)
  if (trackWords(a) !== trackWords(b)) parts.push(`카드 열 너비: ${trackWords(a)} → ${trackWords(b)}`)
  if (!parts.length) return null
  const effect = !effects ? '' : a.overlap && !b.overlap ? ' · 카드 겹침 해소' : !a.overlap && b.overlap ? ` · 카드가 ${b.overlap}px 겹침` : ''
  return `${where} ${parts.join(', ')}${effect}`
}
// The same change as its code values, for beside the words: "repeat(2,
// 360px) → repeat(2, minmax(0, 1fr))".
export function layoutDeltaCode(from, to, screen) {
  if (!from || !to || !layoutChanged(from, to, screen)) return null
  return `${layoutAt(from, screen).template} → ${layoutAt(to, screen).template}`
}

// What's wrong with a layout on a screen — one entry per problem, each with
// the exact area it's about (in the screen's own px), so an inspection
// overlay marks that area and nothing else:
//   · 'overlap' (danger) — the strip where the cards run over each other;
//   · 'squeezed' (warning) — the gap left between cards that should be wider.
// (Two columns only: the strip is between the first card and the last.)
export function problemsAt(spec, screen) {
  const layout = layoutAt(spec, screen)
  if (!layout.tight || layout.columns !== 2) return []
  const { grid, cardWidth } = layout
  if (layout.overlap) return [{ id: 'overlap', tone: 'danger', label: `카드 겹침 ${layout.overlap}px`, region: { x: grid.x + grid.width - cardWidth, y: grid.y, width: layout.overlap, height: grid.height } }]
  return [{ id: 'squeezed', tone: 'warning', label: `카드 간격 ${layout.squeezed}px (기준 ${layout.gap}px)`, region: { x: grid.x + cardWidth, y: grid.y, width: Math.max(layout.squeezed, 2), height: grid.height } }]
}

// The marks for two versions compared (`mine` on the left, `other` on the
// right — or `mine` alone): each side's problems, once each. A problem both
// have in the same place is marked on `mine` only and said to be shared.
// `difference`: with no problem to explain it, where the two lay out
// differently is marked too — the grid, as one area.
export function inspectionsFor(mine, other, screen, { difference = false } = {}) {
  const sameRegion = (a, b) => a.id === b.id && a.region.x === b.region.x && a.region.width === b.region.width && a.region.y === b.region.y && a.region.height === b.region.height
  const left = problemsAt(mine, screen)
  const right = other ? problemsAt(other, screen) : []
  const marks = {
    mine: left.map((mark) => (right.some((theirs) => sameRegion(mark, theirs)) ? { ...mark, shared: true, label: `${mark.label} · 두 버전 공통` } : mark)),
    other: right.filter((mark) => !left.some((ours) => sameRegion(mark, ours))),
  }
  if (difference && other && !marks.mine.length && !marks.other.length && layoutChanged(mine, other, screen)) {
    marks.mine.push({ id: 'difference', tone: 'info', label: '레이아웃이 달라진 영역', region: layoutAt(mine, screen).grid, outline: true })
  }
  return marks
}
