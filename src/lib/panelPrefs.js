// The Workspace's two side panels — the side panel at the left (Files ·
// Layers · Assets · Inspect, and the developer views that used to sit in the
// bottom panel: Terminal, Console) and AI Chat at the right — as what a
// browser remembers of them: open or not, the view, the width.
//
// Both start folded: the canvas has the room until something is asked for.
// The keys carry a version; what an older key said (the panel at the right,
// open) isn't read — everyone starts from the new default.

// The side panel's views, in the activity bar's order. The first four are
// the navigator's own tabs; the rest came from the bottom panel.
export const SIDE_TABS = ['files', 'layers', 'assets', 'inspect']
export const SIDE_TOOLS = ['terminal', 'console']
export const SIDE_VIEWS = [...SIDE_TABS, ...SIDE_TOOLS]

// (`maxShare`: of the window's width — whichever limit is smaller holds.)
export const SIDE_PANEL = { key: 'devsign:sidePanel.v2', width: 240, min: 240, max: 480, maxShare: 0.4 }
export const AI_CHAT = { key: 'devsign:aiChat.v2', width: 380, min: 300, max: 640, maxShare: 0.45 }
// What's left for the canvas with both open, at the least.
export const MIN_CANVAS = 480

// A width kept inside a panel's limits (`viewport`: the window's width, when known).
export function clampWidth(spec, width, viewport = null) {
  const max = viewport ? Math.max(spec.min, Math.min(spec.max, Math.floor(viewport * spec.maxShare))) : spec.max
  const value = Number.isFinite(width) ? width : spec.width
  return Math.round(Math.max(spec.min, Math.min(max, value)))
}

const storageOf = (storage) => storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
function read(spec, storage) {
  try {
    const raw = storageOf(storage)?.getItem(spec.key)
    const value = raw ? JSON.parse(raw) : null
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}
function write(spec, value, storage) {
  try { storageOf(storage)?.setItem(spec.key, JSON.stringify(value)) } catch { /* not kept */ }
}

// { open, tab, width } — folded, on Files, at its own width until the person says otherwise.
export function readSidePanel(storage) {
  const saved = read(SIDE_PANEL, storage)
  return { open: saved.open === true, tab: SIDE_VIEWS.includes(saved.tab) ? saved.tab : 'files', width: clampWidth(SIDE_PANEL, saved.width) }
}
export const writeSidePanel = (state, storage) => write(SIDE_PANEL, { open: Boolean(state.open), tab: SIDE_VIEWS.includes(state.tab) ? state.tab : 'files', width: clampWidth(SIDE_PANEL, state.width) }, storage)

// { open, width }
export function readAiChat(storage) {
  const saved = read(AI_CHAT, storage)
  return { open: saved.open === true, width: clampWidth(AI_CHAT, saved.width) }
}
export const writeAiChat = (state, storage) => write(AI_CHAT, { open: Boolean(state.open), width: clampWidth(AI_CHAT, state.width) }, storage)

// An activity bar icon pressed: another view opens the panel on it (or
// swaps what it shows); the view that's showing folds the panel.
export function pressSideView(state, view) {
  if (!SIDE_VIEWS.includes(view)) return state
  return state.open && state.tab === view ? { ...state, open: false } : { ...state, open: true, tab: view }
}

// With both panels open and less than MIN_CANVAS left between them, the one
// that was already open folds — the one just asked for stays.
// `room`: the work area's width; `opened`: 'side' | 'chat', the one opened last.
export function panelToFold({ room, side, chat, opened }) {
  if (!side.open || !chat.open) return null
  if (room - side.width - chat.width >= MIN_CANVAS) return null
  return opened === 'side' ? 'chat' : 'side'
}

// How many of the activity bar's workspace icons fit (`slots`: the room, in
// icons, after the main ones) — the rest go to "More", which takes a slot
// itself when anything is left over.
export function railSplit(items, slots) {
  if (items.length <= slots) return { shown: items, more: [] }
  const keep = Math.max(0, slots - 1)
  return { shown: items.slice(0, keep), more: items.slice(keep) }
}
