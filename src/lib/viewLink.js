// The Workspace's view — Preview, Screens or Code — and the screen in view
// have an address, like its layers do (lib/changeLink, docLink, historyLink):
//
//   /projects/:id/workspace?view=screens&screen=checkout
//
// `screen` is the screen's id without its "page-" prefix. Anything the
// address says that isn't a view or a screen of the project is read as
// nothing said — the default view, the screen already in view.

export const VIEWS = ['preview', 'screens', 'code']
export const VIEW_LABEL = { preview: 'Preview', screens: 'Screens', code: 'Code' }

export const screenSlug = (screenId) => String(screenId ?? '').replace(/^page-/, '')
export const screenIdOf = (slug, screenIds) => {
  if (!slug) return null
  return screenIds.find((id) => id === slug || screenSlug(id) === slug) ?? null
}

// { view, screen } — each null when the address doesn't name a real one.
export function readViewParams(search, screenIds = []) {
  const params = new URLSearchParams(search ?? '')
  const view = params.get('view')
  return { view: VIEWS.includes(view) ? view : null, screen: screenIdOf(params.get('screen'), screenIds) }
}

// The same address saying this view and screen (whatever else it says is kept).
export function withView(search, { view, screen } = {}) {
  const params = new URLSearchParams(search ?? '')
  if (view !== undefined) { if (view && VIEWS.includes(view)) params.set('view', view); else params.delete('view') }
  if (screen !== undefined) { if (screen) params.set('screen', screenSlug(screen)); else params.delete('screen') }
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// Where a project starts when nothing is remembered: the board for an app of several screens, the page itself for a single page.
export const defaultViewOf = (kind) => (kind === 'single-page' ? 'preview' : 'screens')

// The view a project was last on, kept for the browser.
const key = (projectId) => `devsign:workspaceView.v1:${projectId}`
export function readLastView(projectId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { const value = storage?.getItem(key(projectId)); return VIEWS.includes(value) ? value : null } catch { return null }
}
export function writeLastView(projectId, view, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { if (VIEWS.includes(view)) storage?.setItem(key(projectId), view) } catch { /* not kept */ }
}
