import { closeHowOf, workspacePathOf } from '@/lib/changeLink'

// Docs have an address, the same way a change's detail does (lib/changeLink):
// they're a layer over the Workspace, not a page of their own.
//
//   /projects/:id/workspace?doc=<docId>      one document
//   /projects/:id/workspace?docs=index       the list of documents
//   /projects/:id/workspace?docs=updates     the document updates
//
// One layer at a time: opening a document takes a change's detail off the
// address (and the change side takes the document off — `withoutDoc`).

export const DOCS_VIEWS = ['index', 'updates']

// "/projects/p/workspace?doc=brand-guide" — the link to a document.
export const docHref = (projectId, docId) => `${workspacePathOf(projectId)}?${new URLSearchParams({ doc: docId })}`
// "/projects/p/workspace?docs=index" — the link to the list, or to the updates.
export const docsHref = (projectId, view = 'index') => `${workspacePathOf(projectId)}?${new URLSearchParams({ docs: DOCS_VIEWS.includes(view) ? view : 'index' })}`

// What an address says is open: { doc, docs } — `docs` only ever one of DOCS_VIEWS; both null when neither.
// (A document wins over a list: `?doc=x&docs=index` is the document.)
export function readDocParams(search) {
  const params = new URLSearchParams(search ?? '')
  const doc = params.get('doc') || null
  const docs = !doc && DOCS_VIEWS.includes(params.get('docs')) ? params.get('docs') : null
  return { doc, docs }
}

// The same address without the docs layer.
export function withoutDoc(search) {
  const params = new URLSearchParams(search ?? '')
  params.delete('doc')
  params.delete('docs')
  const text = params.toString()
  return text ? `?${text}` : ''
}

// The same address with the docs layer opened on `target` — { doc: id } or
// { docs: 'index' | 'updates' } — or closed (null). Whatever else the address
// says is kept, except a change's detail: the two are never open together.
const CHANGE_KEYS = ['change', 'evidence', 'source']
export function withDoc(search, target) {
  const params = new URLSearchParams(withoutDoc(search))
  if (target?.doc || target?.docs) for (const key of CHANGE_KEYS) params.delete(key)
  if (target?.doc) params.set('doc', target.doc)
  else if (target?.docs) params.set('docs', DOCS_VIEWS.includes(target.docs) ? target.docs : 'index')
  const text = params.toString()
  return text ? `?${text}` : ''
}

// How an open layer is closed — the same rule, the same mark in history, as a
// change's: back when it was pushed here, else the parameter is taken off in place.
export { closeHowOf }

// Old links — /projects/:id/docs with the view in router state ({ docId },
// { tab: 'dsUpdates' }) — as the address they mean now.
export function legacyDocsHref(projectId, state) {
  if (state?.docId) return docHref(projectId, state.docId)
  return docsHref(projectId, state?.tab === 'dsUpdates' ? 'updates' : 'index')
}
