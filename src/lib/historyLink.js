import { closeHowOf, workspacePathOf } from '@/lib/changeLink'

// History has an address, the same way a change's detail and Docs do
// (lib/changeLink, lib/docLink): it's a layer over the Workspace, not a page
// of its own.
//
//   /projects/:id/workspace?history                 History, on its default checkpoint
//   /projects/:id/workspace?history=<checkpointId>  History, on that checkpoint
//
// One layer at a time: opening History takes a change's detail and Docs off
// the address, and they take History off (`withoutHistory`). Moving from one
// layer to another is a step of its own (pushed), so Back returns to the
// layer it was opened from; moving between checkpoints inside History
// replaces, so scrubbing never floods the browser's history.

const OTHER_LAYERS = ['change', 'evidence', 'source', 'doc', 'docs']

// (`?history`, not `?history=`: said the way it's written.)
const text = (params, checkpointId) => {
  const rest = params.toString()
  const own = checkpointId ? `history=${encodeURIComponent(checkpointId)}` : 'history'
  return `?${rest ? `${rest}&` : ''}${own}`
}

// "/projects/p/workspace?history=h-3" — the link to History (on a checkpoint, when one is named).
export const historyHref = (projectId, checkpointId = null) => `${workspacePathOf(projectId)}${text(new URLSearchParams(), checkpointId)}`

// What an address says: { open, checkpoint } — `open` when History is named at all, `checkpoint` the one it names (null: the default).
export function readHistoryParams(search) {
  const params = new URLSearchParams(search ?? '')
  return { open: params.has('history'), checkpoint: params.get('history') || null }
}

// The same address without the History layer.
export function withoutHistory(search) {
  const params = new URLSearchParams(search ?? '')
  params.delete('history')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// The same address with History opened — `target`: true (its default
// checkpoint), a checkpoint's id, or null to close. Whatever else the address
// says is kept, except the other layers: never two open together.
export function withHistory(search, target) {
  const params = new URLSearchParams(withoutHistory(search))
  if (target == null || target === false) { const rest = params.toString(); return rest ? `?${rest}` : '' }
  for (const key of OTHER_LAYERS) params.delete(key)
  return text(params, target === true ? null : target)
}

// How it's closed — the same rule, the same mark in history, as the other layers'.
export { closeHowOf }

// Old links — /projects/:id/history?v=<id>, or a checkpoint in router state
// ({ highlightId }) — as the address they mean now.
export function legacyHistoryHref(projectId, search, state) {
  const v = new URLSearchParams(search ?? '').get('v')
  return historyHref(projectId, v || state?.highlightId || null)
}
