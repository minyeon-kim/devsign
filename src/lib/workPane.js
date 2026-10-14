// What the activity bar opens at the left of the Workspace, and how wide.
// Said once, here: adding a menu, or moving one between the two kinds, is a
// change to PANELS alone.
//
//   'split' — a work pane beside the Workspace, half and half: what needs
//             room, or is read with the canvas beside it (the changes to
//             check);
//   'list'  — the narrow drawer: a list to pick from (Docs, History, Import,
//             Design Compare — whose pick opens in the work area).
//
// (Files · Layers · Assets · Inspect, Terminal and Console are the side
// panel's views — lib/panelPrefs — and stay as narrow as they are.)
export const PANELS = {
  // (The changes to check are read against the canvas — the element each is about lit there — so the
  // canvas keeps two thirds: the pane is one column, a third wide, until it's dragged wider.)
  conflicts: { kind: 'split', label: 'Conflict Points', ratio: 0.34 },
  docs: { kind: 'list', label: 'Docs' },
  compare: { kind: 'list', label: 'Design Compare' },
  history: { kind: 'list', label: 'History' },
  import: { kind: 'list', label: 'Import' },
}
export const isSplit = (panel) => PANELS[panel]?.kind === 'split'
export const SPLIT_PANELS = Object.keys(PANELS).filter(isSplit)
// A pane's own share to start with: its own, else half.
export const defaultRatio = (panel) => PANELS[panel]?.ratio ?? SPLIT.ratio

// The split's limits: the pane at least 360px, the Workspace at least 480px;
// under 960px of room there's no halving — the pane takes it all.
export const SPLIT = { key: 'devsign:workPane.v1', ratio: 0.5, minPane: 360, minWorkspace: 480, narrow: 960 }

// How wide the pane is, in px, for a share of the room (`room`: the window
// less the activity bar and an open AI Chat).
//   → { width, full } — `full`: no room to split, or maximized: the pane has it all.
export function paneWidth(room, ratio = SPLIT.ratio, { maximized = false } = {}) {
  if (!(room > 0)) return { width: 0, full: false }
  if (maximized || room < SPLIT.narrow) return { width: Math.round(room), full: true }
  const max = Math.max(SPLIT.minPane, room - SPLIT.minWorkspace)
  return { width: Math.round(Math.min(max, Math.max(SPLIT.minPane, room * ratio))), full: false }
}
// The share a dragged width stands for, kept inside the limits.
export const ratioOf = (room, width) => (room > 0 ? paneWidth(room, width / room).width / room : SPLIT.ratio)

const storageOf = (storage) => storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
// { ratio, ratios, last } — the share last dragged to, each pane's own (`ratios`, by panel), and what was
// last open at the left ('side' or a panel's id).
const shareOf = (value) => (Number.isFinite(value) && value > 0.1 && value < 0.9 ? value : null)
export function readSplit(storage) {
  try {
    const saved = JSON.parse(storageOf(storage)?.getItem(SPLIT.key) ?? 'null') ?? {}
    const ratios = Object.fromEntries(SPLIT_PANELS.map((panel) => [panel, shareOf(saved.ratios?.[panel])]).filter(([, value]) => value != null))
    return { ratio: shareOf(saved.ratio) ?? SPLIT.ratio, ratios, last: saved.last === 'side' || isSplit(saved.last) ? saved.last : null }
  } catch { return { ratio: SPLIT.ratio, ratios: {}, last: null } }
}
// The share a pane opens at: the one it was last dragged to, else its own default.
export const ratioFor = (panel, ratios = {}) => ratios[panel] ?? defaultRatio(panel)
export function writeSplit(value, storage) {
  try { storageOf(storage)?.setItem(SPLIT.key, JSON.stringify(value)) } catch { /* not kept */ }
}

// The pane in the address: ?panel=conflicts, ?panel=compare.
export function readPanel(search) {
  const panel = new URLSearchParams(search ?? '').get('panel')
  return isSplit(panel) ? panel : null
}
export function withPanel(search, panel) {
  const params = new URLSearchParams(search ?? '')
  if (isSplit(panel)) params.set('panel', panel)
  else params.delete('panel')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}
