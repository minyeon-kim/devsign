import { layoutAt } from '@/lib/codeRender'

// History's preview has two views of a checkpoint (PreviewPanelContent, with
// `viewControls`): "바뀐 요소" — only what changed since the step before, cut
// out and enlarged — and "화면 전체", the whole screen. This is what the first
// one shows: which box is cut, and how large it's drawn.

export const CHANGED_VIEWS = ['changed', 'full']
export const CHANGED_PAD = 16
// The most a cut is enlarged (before the zoom): past it a small element is a blur of pixels.
export const CHANGED_MAX_SCALE = 3

// Which view is shown: the one picked — but "changed" only when there's something to cut to.
export const viewOf = (pick, hasRegion) => (pick !== 'full' && hasRegion ? 'changed' : 'full')

// The smallest box around all of `boxes` ({ x, y, width, height }); null for none.
export function unionBox(boxes) {
  const list = boxes.filter(Boolean)
  if (!list.length) return null
  const x0 = Math.min(...list.map((box) => box.x))
  const y0 = Math.min(...list.map((box) => box.y))
  const x1 = Math.max(...list.map((box) => box.x + box.width))
  const y1 = Math.max(...list.map((box) => box.y + box.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

// A box with room around it, kept inside `bounds` ({ width, height }).
export function padBox(box, bounds, pad = CHANGED_PAD) {
  if (!box) return null
  const x0 = Math.max(0, box.x - pad)
  const y0 = Math.max(0, box.y - pad)
  const x1 = Math.min(bounds.width, box.x + box.width + pad)
  const y1 = Math.min(bounds.height, box.y + box.height + pad)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

// How large a cut is drawn in the room there is: to fit, up to CHANGED_MAX_SCALE, then the zoom (%).
export function changedScale(room, box, zoom = 100, max = CHANGED_MAX_SCALE) {
  return Math.max(0.05, Math.min(max, room.width / box.width, room.height / box.height)) * (zoom / 100)
}

// Where a code render's parts are on its screen (lib/codeRender's layout — the
// numbers CodeRender draws from, so a part's box is its element's):
//   grid / cards — the card grid;  title, subtitle — the two lines over it;  cta — the button under it.
const TITLE = { height: 36, width: 170 }
const SUBTITLE = { height: 20, width: 230 }
export function partRegionsAt(spec, screen) {
  const { padding, grid } = layoutAt(spec, screen)
  return {
    grid,
    cards: grid,
    title: { x: padding, y: padding, width: TITLE.width, height: TITLE.height },
    subtitle: { x: padding, y: padding + TITLE.height + 4, width: SUBTITLE.width, height: SUBTITLE.height },
    cta: { x: padding, y: grid.y + grid.height + 24, width: grid.width, height: 48 },
  }
}

// What "바뀐 요소" cuts a code render to: the box around everything that
// changed — the grid (`grid`: its layout differs from the step before) and the
// parts a change is about (`parts`) — with CHANGED_PAD around it.
// `specs`: the render(s) shown. With two (a comparison) it's the box around
// both sides' areas, so the two are cut to the same part at the same scale.
// Null when nothing changed here.
export function changedRegionAt(specs, screen, { grid = false, parts = [] } = {}) {
  const shown = specs.filter(Boolean)
  const names = [...(grid ? ['grid'] : []), ...parts]
  if (!shown.length || !names.length) return null
  const boxes = shown.flatMap((spec) => { const regions = partRegionsAt(spec, screen); return names.map((name) => regions[name]) })
  const height = Math.min(screen.height, Math.max(...shown.map((spec) => layoutAt(spec, screen).contentHeight)))
  return padBox(unionBox(boxes), { width: screen.width, height })
}
