import { lazy } from 'react'

// Everything inside a project — its home, Workspace, Docs, History and
// Import — is loaded when it's first needed rather than with the Dashboard.
// `prefetchProject()` starts that load early (a project card calls it on
// hover or focus), so by the click the pages are already there and the
// project opens at once. Each import runs once; later calls reuse it.
const loaders = {
  layout: () => import('@/pages/ProjectLayout'),
  overview: () => import('@/pages/ProjectOverviewPage'),
  workspace: () => import('@/pages/WorkspacePage'),
  docs: () => import('@/pages/DocsPage'),
  history: () => import('@/pages/HistoryPage'),
  importPage: () => import('@/pages/ImportPage'),
}

export const ProjectLayout = lazy(loaders.layout)
export const ProjectOverviewPage = lazy(loaders.overview)
export const WorkspacePage = lazy(loaders.workspace)
export const DocsPage = lazy(loaders.docs)
export const HistoryPage = lazy(loaders.history)
export const ImportPage = lazy(loaders.importPage)

let prefetched = false
export function prefetchProject() {
  if (prefetched) return
  prefetched = true
  // The shell and the two pages a card or its badges lead to.
  for (const load of [loaders.layout, loaders.overview, loaders.workspace]) load().catch(() => { prefetched = false })
}
