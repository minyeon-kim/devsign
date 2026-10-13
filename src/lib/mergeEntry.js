// What the Merge Studio entry needs to say, read from what's there — never from
// a guess:
//   · how many merges are waiting (the Merge List's items not yet merged) — the
//     header button's badge;
//   · which files have changes (edited in the editor, or carrying a draft) — what
//     a new merge is offered to start from: those first, selected by default.

// Merges still to do: everything that isn't merged yet.
export const pendingMergesOf = (mergeItems = []) => mergeItems.filter((item) => item.tag !== 'Merged').length

// The badge's text: nothing for none, "9+" past nine.
export const badgeOf = (count) => (count > 0 ? (count > 9 ? '9+' : String(count)) : null)

// The files with changes: those with a draft, and those the editor holds unsaved.
export function changedFileIdsOf({ draftChanges = {}, editorDirtyFiles = {} } = {}) {
  return new Set([...Object.keys(draftChanges), ...Object.keys(editorDirtyFiles).filter((id) => editorDirtyFiles[id])])
}

// The files in the order they're offered: the changed ones on top (each group in its own order).
export function orderFilesForMerge(files = [], changedIds = new Set()) {
  return [...files.filter((file) => changedIds.has(file.id)), ...files.filter((file) => !changedIds.has(file.id))]
}

// What's selected when the picker opens: every changed file — or nothing, never a guess.
export function defaultSelection(files = [], changedIds = new Set()) {
  return files.filter((file) => changedIds.has(file.id)).map((file) => file.id)
}

// The start button, with how many it starts from.
export const startLabelOf = (count) => `Start merge with ${count} file${count === 1 ? '' : 's'}`

// All of it, for the Workspace to hand to the entry, the list and the empty state.
export function mergeEntryState({ mergeItems = [], files = [], draftChanges = {}, editorDirtyFiles = {} } = {}) {
  const changedIds = changedFileIdsOf({ draftChanges, editorDirtyFiles })
  return { pending: pendingMergesOf(mergeItems), changedIds, changedCount: files.filter((file) => changedIds.has(file.id)).length }
}
