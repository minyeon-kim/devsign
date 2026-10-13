import { closeHowOf, workspacePathOf } from '@/lib/changeLink'

// History has an address, the same way a change's detail and Docs do
// (lib/changeLink, lib/docLink): it's a layer over the Workspace, not a page
// of its own.
//
//   /projects/:id/workspace?history                 History, on its default checkpoint
//   /projects/:id/workspace?history=<checkpointId>  History, on that checkpoint
//   …&view=code | &view=split                       the Code tab, or Screen and Code together (the Screen tab is the default: nothing said)
//
// One layer at a time: opening History takes a change's detail and Docs off
// the address, and they take History off (`withoutHistory`). Moving from one
// layer to another is a step of its own (pushed), so Back returns to the
// layer it was opened from; moving between checkpoints inside History
// replaces, so scrubbing never floods the browser's history.

const OTHER_LAYERS = ['change', 'evidence', 'source', 'doc', 'docs']

// (`?history`, not `?history=`: said the way it's written.)
const VIEWS = ['screen', 'code', 'split']
const text = (params, checkpointId, view = null) => {
  const rest = params.toString()
  const own = checkpointId ? `history=${encodeURIComponent(checkpointId)}` : 'history'
  return `?${rest ? `${rest}&` : ''}${own}${view === 'code' || view === 'split' ? `&view=${view}` : ''}`
}

// "/projects/p/workspace?history=h-3" — the link to History (on a checkpoint, when one is named).
export const historyHref = (projectId, checkpointId = null) => `${workspacePathOf(projectId)}${text(new URLSearchParams(), checkpointId)}`

// What an address says: { open, checkpoint } — `open` when History is named at all, `checkpoint` the one it names (null: the default).
export function readHistoryParams(search) {
  const params = new URLSearchParams(search ?? '')
  return { open: params.has('history'), checkpoint: params.get('history') || null }
}

// The tab it names: 'code', 'split' (screen and code together), or null (nothing said — the Screen tab, unless the checkpoint only changed code).
export function readHistoryView(search) {
  const view = new URLSearchParams(search ?? '').get('view')
  return view === 'code' || view === 'split' ? view : null
}

// The same address without the History layer (its tab goes with it).
export function withoutHistory(search) {
  const params = new URLSearchParams(search ?? '')
  params.delete('history')
  params.delete('view')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// The same address with History opened — `target`: true (its default
// checkpoint), a checkpoint's id, or null to close. Whatever else the address
// says is kept, except the other layers: never two open together.
// Moving between checkpoints keeps the tab; closing takes it off.
export function withHistory(search, target) {
  const view = new URLSearchParams(search ?? '').get('view')
  const params = new URLSearchParams(withoutHistory(search))
  if (target == null || target === false) { const rest = params.toString(); return rest ? `?${rest}` : '' }
  for (const key of OTHER_LAYERS) params.delete(key)
  return text(params, target === true ? null : target, view)
}

// The same address on a tab — 'code' and 'split' say so; 'screen', the default, says nothing.
// (Only on an address that names History.)
export function withHistoryView(search, view) {
  const params = new URLSearchParams(search ?? '')
  if (!params.has('history')) return search ?? ''
  const checkpoint = params.get('history') || null
  params.delete('history')
  params.delete('view')
  return text(params, checkpoint, VIEWS.includes(view) ? view : null)
}

// How it's closed — the same rule, the same mark in history, as the other layers'.
export { closeHowOf }

// Old links — /projects/:id/history?v=<id>, or a checkpoint in router state
// ({ highlightId }) — as the address they mean now.
export function legacyHistoryHref(projectId, search, state) {
  const v = new URLSearchParams(search ?? '').get('v')
  return historyHref(projectId, v || state?.highlightId || null)
}
