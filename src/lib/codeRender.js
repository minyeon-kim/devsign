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

export const VIEWPORTS = [
  { id: 'mobile', label: 'Mobile', width: 390, height: 700 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 640 },
  { id: 'desktop', label: 'Desktop', width: 1280, height: 720 },
]
export const viewportOf = (id) => VIEWPORTS.find((viewport) => viewport.id === id) ?? VIEWPORTS[1]

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

const CODE_RENDERERS = {
  'dashboard-redesign:app': { parse: parseDashboardGrid, file: 'src/components/dashboard/DashboardGrid.tsx', defaultViewport: 'tablet' },
}

export const hasCodeRenderer = (projectId, fileId) => Boolean(CODE_RENDERERS[`${projectId}:${fileId}`])
export const defaultViewportFor = (projectId, fileId) => CODE_RENDERERS[`${projectId}:${fileId}`]?.defaultViewport ?? 'tablet'

// `{ spec, file }` for a checkpoint's code, `{ error }` when it has a
// renderer that can't read it, null when its file has no renderer at all.
export function renderOf(projectId, fileId, lines) {
  const renderer = CODE_RENDERERS[`${projectId}:${fileId}`]
  if (!renderer) return null
  if (!Array.isArray(lines) || !lines.length) return { error: 'This checkpoint has no code snapshot to render.' }
  const spec = renderer.parse(lines)
  return spec ? { spec, file: renderer.file } : { error: 'This checkpoint’s code couldn’t be read into a layout.' }
}

// The grid as the screen lays it out at a viewport: the columns, and —
// when the code asks for fixed-width cards that don't fit the screen —
// how far each card runs over the next (StatCard keeps the width; the
// grid can't be wider than the screen).
export function layoutAt(spec, viewportId) {
  const viewport = viewportOf(viewportId)
  const template = viewport.id === 'tablet' ? spec.tablet : spec.base
  const parsed = parseTemplate(template)
  const padding = viewport.id === 'mobile' ? 16 : 32
  const gap = viewport.id === 'mobile' ? 12 : 24
  const available = viewport.width - padding * 2
  // Fixed tracks wider than the screen: the first card sits at the left
  // edge, the last at the right, and they run over each other by what's
  // left (2 × 360px in 704px → 16px).
  const needed = parsed.fixed ? parsed.fixed * parsed.count + gap * (parsed.count - 1) : 0
  const overlap = parsed.fixed && parsed.count > 1 && needed > available ? Math.max(0, Math.round((parsed.fixed * parsed.count - available) / (parsed.count - 1))) : 0
  return { viewport, template: parsed.template, columns: parsed.count, padding, gap, cardWidth: parsed.fixed, overlap, clipped: Boolean(parsed.fixed && needed > available && !overlap) }
}

// Whether two checkpoints lay the screen out differently at a viewport.
export function layoutChanged(spec, previous, viewportId) {
  if (!spec || !previous) return false
  return layoutAt(spec, viewportId).template !== layoutAt(previous, viewportId).template
}
